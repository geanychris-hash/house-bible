---
type: research
project: House Bible
updated: 2026-10-03
companion: "House Bible - Feature gaps (Claude reference).md"
---
# House Bible: what other home apps do that we don't

I compared House Bible v2 (the merged `main` build) against the home-management apps people actually use in 2026: HomeZada, Homer, Dwellin, HomeBinder, DwellPulse, Upkeepify, OnOtto, the late Centriq, the self-hosted HomeBox and Grocy, and the wall-dashboard products DAKboard and Skylight.

**Short version:** House Bible already covers more than most paid apps (maintenance, documents, rooms, warranties, shutoffs, contractors, projects, money, utilities, steam log). The real gaps are smaller. Below they're sorted by how much I think you'd use them. I left out anything that goes against your rules (no AI, no price scraping, free, no weekly digest).

## Worth adding

1. **Search everything from one box.** v1 had it (press `/` or Ctrl+K). v2 lost it: each screen has its own search, but there's no app-wide search. When you're in the basement asking "what size is the furnace filter" or "who did the chimney", one box beats knowing which screen to open. Small job, big daily payoff.

2. **"Who did the work" on every job.** You can log a completed task with a cost, and you keep a contractors list, but the two aren't linked. And an appliance's page lists its tasks, not when they were actually done. Every serious app ties a service visit to the item and the person who did it. Add a contractor field to task log entries and expenses. Then a contractor's page can show every job they did and the total spent, and the boiler's page can show its full service history with dates, costs and names.

3. **Lifespan and replacement planning.** Dwellin and HomeZada estimate when big systems will need replacing and what that costs per year. For an old house this matters most: boiler, water heater, roof, chimney liner. Add "expected life (years)" and "replacement cost" to systems and appliances, then show a "Coming up for replacement" list and a yearly amount to set aside. Everything is typed in by you, so it fits the manual-entry rule.

4. **Value for the insurance inventory.** The insurance report exists but has nothing reliable to total up. Systems and appliances have no purchase price or value field; the report guesses by matching expense names. HomeZada and HomeBox both store purchase price and value per item. Add purchase price, purchase date and replacement value, plus a "belongings" type for furniture, electronics and the like, so the printout is something you could actually hand an adjuster after a fire or break-in.

5. **Wall display mode.** You've said a wall-mounted calendar is coming. DAKboard and Skylight are basically a big-type "today" screen: calendar, weather, chores. House Bible already has the data. A read-only `#/wall` screen with large text that refreshes itself, showing today's tasks, overdue items, the freeze or snow warning, and the next few calendar days, would let a cheap tablet or the home-server box serve as that display without a subscription.

6. **Recall checks.** HomeBinder, Upkeepify and the late Centriq warn you when something you own is recalled. The US Consumer Product Safety Commission has a free public recall API, no key needed. A monthly Apps Script job could check your appliance brands and models and email you a match, the same way weather alerts work. One catch: this is the app fetching data on its own. It's public safety data, not prices, but it's your call. Matching on model numbers is also fuzzy, so expect the odd false alarm.

## Nice to have

7. **Heating efficiency check.** Utility bills are compared year over year, but a cold winter makes any boiler look bad. Dividing gas use by "heating degree days" (a measure of how cold it was) shows whether the steam system itself is getting worse, for example a bad vent or a sooty boiler. Useful for a one-pipe steam house in particular.

8. **Fair chore split.** Tasks can be assigned to you, your wife or either. Grocy can rotate "either" jobs automatically so whoever did fewer gets the next one. Only useful if "either" jobs keep getting dropped.

9. **Insurance, mortgage and tax renewals.** You can put an expiry date on documents, but there's no place for policy renewals, premium history or the property tax schedule. A small "policies" list with renewal reminders would cover it.

10. **Change history.** The backend already logs every change (who, when) in a hidden tab. A simple "recent changes" screen would show what your wife updated and help undo mistakes.

11. **House history packet.** DwellPulse and HomeBinder can bundle the whole house record (work done, warranties, manuals, improvements) for a sale or a refinance. You have most of it in the reports screen; one "export house history" button would finish it. This is a someday feature.

12. **Where things are stored.** HomeBox tracks which shelf or bin an item lives in and who borrowed it. Your tools have no location field. Low priority unless the garage gets out of hand.

## Seen elsewhere, deliberately skipped

- AI photo recognition, automatic manual lookup, AI assistants (HomeZada, Homer, OnOtto): you ruled out AI.
- Home value and equity estimates (HomeZada): needs paid data feeds, and Zillow is a click away.
- Contractor marketplaces and booking (HomeBinder, Dwellin rewards): not free or neutral.
- Points, streaks, leaderboards (OnOtto, Sweepy): not your style.
- Meal planning and grocery lists (Skylight, Grocy): outside a house manual.
- Weekly digest email: you said no.
- Barcode scanning and data-plate reading: cut from v2 on purpose.

## Where House Bible is already ahead

One-pipe-steam-specific tasks and a steam log, a shutoffs and emergency sheet that works offline, encrypted sensitive notes, weather alerts by email, project dependencies and materials pricing across stores, a capital-improvement tally for tax basis, and QR labels. None of the paid apps have the steam features, and few have shutoffs or project dependencies.

## Suggested order
Do 1 and 2 first (small, daily use). Then 3 and 4 together, since both add fields to the same systems-and-appliances table. 5 when the wall tablet arrives. 6 if you're comfortable with the app fetching recall data.
