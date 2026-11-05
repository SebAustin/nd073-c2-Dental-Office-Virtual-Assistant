# Contoso Dentistry Virtual Assistant

A chat assistant on the Contoso Dentistry website that answers patient questions and books appointment times with the office's scheduler.

## People

**Practice**:
Contoso Dentistry, the fictional dental office whose location, hours, staff and policies the assistant and website describe.
_Avoid_: Clinic, office (as a defined term), business

**Patient**:
Anyone chatting with the assistant on the website, whether new or existing; the assistant never learns who they are.
_Avoid_: User, customer, client, visitor

## Scheduling

**Time slot**:
A time of day the office offers for an appointment, such as "10am"; it carries no date.
_Avoid_: Slot time, opening, availability (as a noun for one time)

**Availability**:
The list of time slots the scheduler currently offers.
_Avoid_: Schedule, calendar, openings

**Appointment**:
One time slot booked by a patient during their conversation.
_Avoid_: Booking, reservation, visit

**Forgetting an appointment**:
The assistant dropping the appointment it remembers for this conversation; the scheduler is not told, so it is not a cancellation with the practice.
_Avoid_: Cancel appointment, delete booking

**Scheduler**:
The office's third-party scheduling service that reports availability and accepts appointments; it is outside our control.
_Avoid_: Calendar, booking system, scheduler app

## Understanding the patient

**Knowledge base**:
The office's set of question-and-answer pairs the assistant answers from.
_Avoid_: FAQ database, QnA

**Intent**:
What a patient's message is asking the assistant to do, such as checking availability or scheduling an appointment.
_Avoid_: Command, action, goal

**Fallback**:
The reply sent when a message matches no intent and no knowledge base answer, reminding the patient what the assistant can do.
_Avoid_: Error message, default reply
