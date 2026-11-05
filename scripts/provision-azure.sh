#!/usr/bin/env bash
# Creates the Azure resources for the Contoso Dentistry assistant (see README, "Azure setup").
# GitHub CI/CD for the App Services and the Static Web App is connected afterwards in the portal's
# Deployment Center, so Azure generates the workflow files the rubric asks for.
#
# Usage:  az login
#         ACCEPT_RAI_TERMS=yes RG=<your lab resource group> scripts/provision-azure.sh
# Works in the Udacity Cloud Lab: an existing resource group is reused (its region wins), and when the
# account may not create Entra app registrations the bot uses a User-Assigned Managed Identity instead.
# Options (env): RG  LOCATION=centralus  SUFFIX=<4 chars>  LANGUAGE_SKU=F0|S  SEARCH_SKU=free|basic
#                PLAN_SKU=F1|B1  BOT_IDENTITY=auto|SingleTenant|UserAssignedMSI
# Outputs: .azure/outputs.env (gitignored; contains secrets) and starter/ContosoDentistryChatBot/.env

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/.azure"
mkdir -p "$OUT_DIR"
SUFFIX_FILE="$OUT_DIR/suffix"

RG="${RG:-DentistVirtualAssistant}"
LOCATION="${LOCATION:-centralus}"
LANGUAGE_SKU="${LANGUAGE_SKU:-F0}"
SEARCH_SKU="${SEARCH_SKU:-free}"
PLAN_SKU="${PLAN_SKU:-F1}"
BOT_IDENTITY="${BOT_IDENTITY:-auto}"
SUFFIX="${SUFFIX:-$( [ -f "$SUFFIX_FILE" ] && cat "$SUFFIX_FILE" || openssl rand -hex 2 )}"
echo "$SUFFIX" > "$SUFFIX_FILE"

NAME="contoso-dental"
SEARCH="$NAME-search-$SUFFIX"
LANGUAGE="$NAME-lang-$SUFFIX"
PLAN="$NAME-plan-$SUFFIX"
BOT_APP="$NAME-bot-app-$SUFFIX"
SCHEDULER_APP="$NAME-scheduler-$SUFFIX"
BOT="$NAME-bot-$SUFFIX"
AAD_APP="$NAME-bot-identity-$SUFFIX"
MSI="$NAME-bot-msi-$SUFFIX"

step() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }

if [ "${ACCEPT_RAI_TERMS:-}" != "yes" ]; then
    echo "Creating an Azure AI Language resource requires accepting Microsoft's Responsible AI terms."
    echo "Re-run with ACCEPT_RAI_TERMS=yes once you have read and accepted them."
    exit 1
fi

SUBSCRIPTION="$(az account show --query name -o tsv)"
TENANT_ID="$(az account show --query tenantId -o tsv)"

step "Resource group"
if az group show -n "$RG" -o none 2>/dev/null; then
    LOCATION="$(az group show -n "$RG" --query location -o tsv)"
    echo "Reusing existing resource group $RG in $LOCATION"
else
    az group create -n "$RG" -l "$LOCATION" -o none
fi
echo "Subscription: $SUBSCRIPTION  |  resource group: $RG  |  region: $LOCATION  |  suffix: $SUFFIX"

step "Azure AI Search ($SEARCH_SKU) — storage for the Custom Question Answering knowledge base"
az search service show -g "$RG" -n "$SEARCH" -o none 2>/dev/null \
    || az search service create -g "$RG" -n "$SEARCH" -l "$LOCATION" --sku "$SEARCH_SKU" -o none
SEARCH_ID="$(az search service show -g "$RG" -n "$SEARCH" --query id -o tsv)"
SEARCH_KEY="$(az search admin-key show -g "$RG" --service-name "$SEARCH" --query primaryKey -o tsv)"

step "Azure AI Language ($LANGUAGE_SKU) — CLU + Custom Question Answering"
az cognitiveservices account show -g "$RG" -n "$LANGUAGE" -o none 2>/dev/null \
    || az cognitiveservices account create -g "$RG" -n "$LANGUAGE" -l "$LOCATION" \
        --kind TextAnalytics --sku "$LANGUAGE_SKU" --custom-domain "$LANGUAGE" --yes \
        --api-properties qnaAzureSearchEndpointId="$SEARCH_ID" qnaAzureSearchEndpointKey="$SEARCH_KEY" -o none
LANGUAGE_ENDPOINT="$(az cognitiveservices account show -g "$RG" -n "$LANGUAGE" --query properties.endpoint -o tsv)"
LANGUAGE_KEY="$(az cognitiveservices account keys list -g "$RG" -n "$LANGUAGE" --query key1 -o tsv)"

step "App Service plan ($PLAN_SKU, Linux) and web apps (Node 22)"
az appservice plan create -g "$RG" -n "$PLAN" -l "$LOCATION" --is-linux --sku "$PLAN_SKU" -o none
for APP in "$BOT_APP" "$SCHEDULER_APP"; do
    az webapp show -g "$RG" -n "$APP" -o none 2>/dev/null \
        || az webapp create -g "$RG" -p "$PLAN" -n "$APP" --runtime "NODE:22-lts" -o none
    az webapp config set -g "$RG" -n "$APP" --startup-file "npm start" --min-tls-version 1.2 --ftps-state Disabled -o none
    az webapp update -g "$RG" -n "$APP" --https-only true -o none
done
SCHEDULER_URL="https://$(az webapp show -g "$RG" -n "$SCHEDULER_APP" --query defaultHostName -o tsv)/"
BOT_HOST="$(az webapp show -g "$RG" -n "$BOT_APP" --query defaultHostName -o tsv)"

create_single_tenant_identity() {
    APP_ID="$(az ad app list --display-name "$AAD_APP" --query '[0].appId' -o tsv 2>/dev/null || true)"
    if [ -z "$APP_ID" ]; then
        APP_ID="$(az ad app create --display-name "$AAD_APP" --sign-in-audience AzureADMyOrg --query appId -o tsv 2>/dev/null)" || return 1
    fi
    # The bot authenticates with client credentials, which needs a service principal in the tenant.
    az ad sp show --id "$APP_ID" -o none 2>/dev/null || az ad sp create --id "$APP_ID" -o none || return 1
    APP_PASSWORD="$(az ad app credential reset --id "$APP_ID" --display-name bot-secret --years 1 --query password -o tsv --only-show-errors)" || return 1
    APP_TYPE=SingleTenant
}

create_managed_identity() {
    az identity show -g "$RG" -n "$MSI" -o none 2>/dev/null || az identity create -g "$RG" -n "$MSI" -l "$LOCATION" -o none
    APP_ID="$(az identity show -g "$RG" -n "$MSI" --query clientId -o tsv)"
    MSI_ID="$(az identity show -g "$RG" -n "$MSI" --query id -o tsv)"
    az webapp identity assign -g "$RG" -n "$BOT_APP" --identities "$MSI_ID" -o none
    APP_PASSWORD=""
    APP_TYPE=UserAssignedMSI
}

step "Bot identity ($BOT_IDENTITY)"
case "$BOT_IDENTITY" in
    SingleTenant) create_single_tenant_identity ;;
    UserAssignedMSI) create_managed_identity ;;
    *) create_single_tenant_identity || { echo "App registration not permitted here; using a managed identity."; create_managed_identity; } ;;
esac
echo "Bot identity type: $APP_TYPE"

step "Azure Bot ($BOT) with the Direct Line channel"
if ! az bot show -g "$RG" -n "$BOT" -o none 2>/dev/null; then
    if [ "$APP_TYPE" = UserAssignedMSI ]; then
        az bot create -g "$RG" -n "$BOT" --app-type UserAssignedMSI --appid "$APP_ID" --tenant-id "$TENANT_ID" \
            --msi-resource-id "$MSI_ID" --endpoint "https://$BOT_HOST/api/messages" --sku F0 -o none
    else
        az bot create -g "$RG" -n "$BOT" --app-type SingleTenant --appid "$APP_ID" --tenant-id "$TENANT_ID" \
            --endpoint "https://$BOT_HOST/api/messages" --sku F0 -o none
    fi
fi
az bot directline show -g "$RG" -n "$BOT" -o none 2>/dev/null \
    || az bot directline create -g "$RG" -n "$BOT" -o none
DIRECT_LINE_SECRET="$(az bot directline show -g "$RG" -n "$BOT" --with-secrets true --query 'properties.properties.sites[0].key' -o tsv)"

step "Writing configuration"
SETTINGS=(
    "MicrosoftAppType=$APP_TYPE"
    "MicrosoftAppId=$APP_ID"
    "MicrosoftAppPassword=$APP_PASSWORD"
    "MicrosoftAppTenantId=$TENANT_ID"
    "LanguageEndpoint=$LANGUAGE_ENDPOINT"
    "LanguageKey=$LANGUAGE_KEY"
    "CluProjectName=ContosoDentistryCLU"
    "CluDeploymentName=production"
    "CqaProjectName=ContosoDentistryFAQ"
    "CqaDeploymentName=production"
    "IntentThreshold=0.6"
    "AnswerThreshold=0.5"
    "SchedulerEndpoint=$SCHEDULER_URL"
    "DirectLineSecret=$DIRECT_LINE_SECRET"
    "AllowedOrigins=${ALLOWED_ORIGINS:-http://localhost:4280}"
)
az webapp config appsettings set -g "$RG" -n "$BOT_APP" -o none \
    --settings "${SETTINGS[@]}" SCM_DO_BUILD_DURING_DEPLOYMENT=true
az webapp config appsettings set -g "$RG" -n "$SCHEDULER_APP" -o none --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true

umask 077
{
    echo "# Generated by scripts/provision-azure.sh — contains secrets, never commit."
    echo "# Bot identity is left blank locally so the Bot Framework Emulator can connect without auth;"
    echo "# the real identity lives in the App Service settings."
    printf '%s\n' "${SETTINGS[@]}" | sed -E 's/^(MicrosoftApp(Type|Id|Password|TenantId))=.*/\1=/'
} > "$ROOT/starter/ContosoDentistryChatBot/.env"
{
    echo "RG=$RG"; echo "LOCATION=$LOCATION"; echo "SUFFIX=$SUFFIX"
    echo "BOT=$BOT"; echo "BOT_APP=$BOT_APP"; echo "BOT_URL=https://$BOT_HOST"
    echo "SCHEDULER_APP=$SCHEDULER_APP"; echo "SCHEDULER_URL=$SCHEDULER_URL"
    echo "LANGUAGE=$LANGUAGE"; echo "LANGUAGE_ENDPOINT=$LANGUAGE_ENDPOINT"; echo "SEARCH=$SEARCH"
} > "$OUT_DIR/outputs.env"

step "Done"
cat "$OUT_DIR/outputs.env"
echo
echo "Next: node scripts/deploy-language.js   (trains CLU and builds the knowledge base)"
