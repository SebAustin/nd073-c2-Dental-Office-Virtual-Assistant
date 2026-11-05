# Azure AI Language (CQA + CLU) replaces QnA Maker and LUIS

The course asks us to answer FAQs with QnA Maker and to recognize scheduling intents with LUIS. As of this project (November 2026), both services are retired: QnA Maker on 2025-03-31 and LUIS around 2025-10-01. The course's advice to keep using them dates from before the retirement. We use their successors in a single Azure AI Language resource instead. **Custom Question Answering** holds the FAQ knowledge base, imported from `FAQ.tsv`. **Conversational Language Understanding** handles the `GetAvailability` and `ScheduleAppointment` intents and the date-time entity. We keep the course's own names (knowledge base, intent, date-time entity) so reviewers can map the work to the rubric. The README explains the swap.

## Considered options

- **Keep QnA Maker / LUIS as the course text says**: rejected. Neither service can be created or called any more.
- **Replace both with an LLM (Azure OpenAI) prompt**: rejected. It strays too far from the rubric's "train QnA / train LUIS" criteria, and it is harder to show as "trained".

## Consequences

- The starter's `QnAMaker` and `LuisRecognizer` classes are replaced by two small REST clients: `src/questionanswerer.js` for the knowledge base and `intentrecognizer.js` for CLU. This removes the `botbuilder-ai` dependency, and plain REST is easy to test with a fake `fetch`.
- Custom Question Answering needs an Azure AI Search resource linked to the Language resource; the free Search tier is enough.
- The `.env` keys change from QnA/LUIS names to Language resource endpoint, key, project and deployment names.
