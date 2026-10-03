const SEED_TASKS = [
 {
  "id": "fall-boiler-service",
  "season": "Fall",
  "title": "Schedule annual boiler service",
  "rule": {
   "type": "yearly"
  },
  "start": "2026-10-01",
  "time": "15 min to book; 1-2 hr visit",
  "tools": "Phone",
  "why": "Steam boilers need yearly combustion and safety checks before heating season; early booking avoids the October rush.",
  "how": "Call heating tech. Ask for combustion test, low-water cutoff and pressuretrol check, and flue inspection. Log date in House Bible > Systems.",
  "safety": "Gas/combustion work is for licensed techs.",
  "done": []
 },
 {
  "id": "fall-radiator-check",
  "season": "Fall",
  "title": "Radiator walk-through before first heat",
  "rule": {
   "type": "yearly"
  },
  "start": "2026-10-03",
  "time": "1 hr",
  "tools": "Level, flashlight, wrench for valve packing nut, replacement air vents",
  "why": "One-pipe steam needs every radiator pitched toward its supply valve and venting properly or you get water hammer and uneven heat.",
  "how": "Check each radiator slopes slightly toward the valve (condensate must drain back). Confirm each supply valve is fully open (never half open). Test each air vent: blow through it, it should pass air and close when hot. Replace stuck or spitting vents. Record models in Systems.",
  "safety": "Do not open valves or touch pipes on a hot system.",
  "done": []
 },
 {
  "id": "fall-main-vents",
  "season": "Fall",
  "title": "Inspect and clean main vents",
  "rule": {
   "type": "yearly"
  },
  "start": "2026-10-05",
  "time": "30 min",
  "tools": "Flashlight, small brush, replacement main vent (Gorton #2 or per system)",
  "why": "Main vents let air out of steam mains so steam reaches the far radiators quickly. A stuck vent causes slow heat and higher fuel use.",
  "how": "With system cold, check each main vent for corrosion, clogs, and leaks. Replace failed vents (most last 10-20 years). Verify vent capacity fits your main length.",
  "safety": "System must be cold and off.",
  "done": []
 },
 {
  "id": "fall-water-level",
  "season": "Fall",
  "title": "Check boiler water level and gauge glass",
  "rule": {
   "type": "yearly"
  },
  "start": "2026-10-07",
  "time": "10 min",
  "tools": "Flashlight",
  "why": "Correct water level (about mid sight glass) protects the boiler and keeps it from short cycling.",
  "how": "Cold boiler: water should sit around the middle of the glass. Add water slowly via the auto-feed or manual valve if low. Note unusual color.",
  "safety": "Never add cold water to a hot, low boiler.",
  "done": []
 },
 {
  "id": "fall-pressuretrol",
  "season": "Fall",
  "title": "Confirm pressuretrol and gauge are sane",
  "rule": {
   "type": "yearly"
  },
  "start": "2026-10-08",
  "time": "15 min",
  "tools": "None",
  "why": "Residential steam runs on ounces, not pounds. Cut-out over about 2 psi wastes fuel and stresses fittings.",
  "how": "Check the pressure gauge while running; it should peak well under 2 psi. Ask the tech to lower settings if higher.",
  "safety": "Adjustments by a qualified person.",
  "done": []
 },
 {
  "id": "fall-detectors",
  "season": "Fall",
  "title": "Test smoke and CO detectors, swap batteries",
  "rule": {
   "type": "yearly"
  },
  "start": "2026-10-10",
  "time": "30 min",
  "tools": "Fresh batteries, step ladder",
  "why": "Heating season is when CO risk rises. Massachusetts requires working CO and smoke alarms.",
  "how": "Test every unit, replace batteries (or unit if 10 years from manufacture date on back). Record install dates in Systems.",
  "safety": "",
  "done": []
 },
 {
  "id": "fall-hosebibs",
  "season": "Fall",
  "title": "Winterize outdoor faucets",
  "rule": {
   "type": "yearly"
  },
  "start": "2026-10-15",
  "time": "30 min",
  "tools": "Screwdriver, bucket",
  "why": "Frozen hose bibs split pipes behind the wall. Do this before the first hard freeze (MA often late Oct to early Nov).",
  "how": "Remove hoses. Close interior shutoff for each bib, open the outdoor spigot to drain, and leave it open. Add insulated covers. Frost-free models still need hoses off.",
  "safety": "",
  "done": []
 },
 {
  "id": "fall-gutters",
  "season": "Fall",
  "title": "Clean gutters after leaf drop",
  "rule": {
   "type": "yearly"
  },
  "start": "2026-11-15",
  "time": "2-3 hr",
  "tools": "Ladder, gloves, hose, scoop",
  "why": "Clogged gutters cause ice dams and foundation water.",
  "how": "Clear debris, flush downspouts, confirm water exits 4-6 ft from the foundation.",
  "safety": "Ladder safety; stay off roof.",
  "done": []
 },
 {
  "id": "fall-storms",
  "season": "Fall",
  "title": "Install storm windows, check weatherstripping",
  "rule": {
   "type": "yearly"
  },
  "start": "2026-10-20",
  "time": "2-4 hr",
  "tools": "Caulk gun, weatherstrip, screwdriver",
  "why": "Old house drafts add up; lower heat loss means steam runs less.",
  "how": "Hang storms, seal gaps with rope caulk or weatherstripping, check door sweeps.",
  "safety": "",
  "done": []
 },
 {
  "id": "fall-chimney",
  "season": "Fall",
  "title": "Chimney and flue inspection",
  "rule": {
   "type": "yearly"
  },
  "start": "2026-10-12",
  "time": "1 hr visit",
  "tools": "Phone",
  "why": "Blocked or cracked flues cause CO and fire risk.",
  "how": "Have a chimney pro inspect and sweep; ask them to check the boiler flue connection.",
  "safety": "Pro task.",
  "done": []
 },
 {
  "id": "heat-lwco-flush",
  "season": "Heating season",
  "title": "Flush low-water cutoff",
  "rule": {
   "type": "weekly",
   "from": "11-01",
   "to": "04-30"
  },
  "start": "2026-11-01",
  "time": "5-10 min",
  "tools": "Bucket, gloves",
  "why": "Sediment can cause the low-water cutoff to stick, which is the safety that stops the burner when water is low. Many manufacturers call for a weekly flush during the heating season; follow your manual.",
  "how": "Per your LWCO manual: with boiler running, open the drain briefly to flush, verify burner shuts off if designed to, then close and refill to level. Not sure of the procedure? Ask the tech to show you.",
  "safety": "Scalding risk. Confirm procedure with the manual or your tech first.",
  "done": []
 },
 {
  "id": "heat-water-level",
  "season": "Heating season",
  "title": "Check boiler water level",
  "rule": {
   "type": "weekly",
   "from": "11-01",
   "to": "04-30"
  },
  "start": "2026-11-01",
  "time": "2 min",
  "tools": "None",
  "why": "A boiler that runs low can be damaged or shut down.",
  "how": "Look at the gauge glass; level stable near mid-glass. Sudden drops mean a leak or system issue.",
  "safety": "",
  "done": []
 },
 {
  "id": "heat-skim",
  "season": "Heating season",
  "title": "Boiler skim/blow-down if needed",
  "rule": {
   "type": "yearly"
  },
  "start": "2026-11-10",
  "time": "1-2 hr",
  "tools": "Hoses, bucket, per manual",
  "why": "Dirty water causes surging and wet steam.",
  "how": "Only if water looks dirty or surges: follow skimming procedure from your boiler manual or have your tech do it.",
  "safety": "Hot water and steam hazards.",
  "done": []
 },
 {
  "id": "heat-radiator-noise",
  "season": "Heating season",
  "title": "Listen for water hammer, note cold radiators",
  "rule": {
   "type": "yearly"
  },
  "start": "2026-12-05",
  "time": "15 min",
  "tools": "Notebook",
  "why": "Banging or cold radiators reveal pitch, vent, or pipe-drain problems early.",
  "how": "Note each problem radiator in Systems. Usual fixes: re-pitch, replace vent, open valve fully, check pipe pitch to drain.",
  "safety": "",
  "done": []
 },
 {
  "id": "heat-humidity",
  "season": "Heating season",
  "title": "Check indoor humidity and window condensation",
  "rule": {
   "type": "yearly"
  },
  "start": "2027-01-10",
  "time": "5 min",
  "tools": "Hygrometer",
  "why": "Dry indoor air in winter and condensation on old windows signal moisture balance issues.",
  "how": "Keep around 30-40% RH in winter; adjust humidifier.",
  "safety": "",
  "done": []
 },
 {
  "id": "winter-icedams",
  "season": "Winter",
  "title": "Watch for ice dams after heavy snow",
  "rule": {
   "type": "yearly"
  },
  "start": "2027-01-20",
  "time": "15 min",
  "tools": "Roof rake",
  "why": "Ice dams force water under shingles and into ceilings and walls.",
  "how": "Roof rake the first 3-4 ft after heavy snow; inspect ceilings for stains. Long-term fix is air sealing and attic insulation.",
  "safety": "Never climb an icy roof.",
  "done": []
 },
 {
  "id": "winter-freeze",
  "season": "Winter",
  "title": "Cold snap checklist",
  "rule": {
   "type": "yearly"
  },
  "start": "2027-01-25",
  "time": "20 min",
  "tools": "None",
  "why": "Below about 10 F, exposed pipes in exterior walls and basements can freeze.",
  "how": "Open cabinet doors on exterior walls, let faucets drip, keep basement heat on, know your main water shutoff.",
  "safety": "",
  "done": []
 },
 {
  "id": "winter-filters",
  "season": "Winter",
  "title": "Replace HVAC/humidifier/range hood filters",
  "rule": {
   "type": "yearly"
  },
  "start": "2027-02-01",
  "time": "30 min",
  "tools": "New filters",
  "why": "Clean filters keep air quality and airflow up.",
  "how": "Swap filters on the appliances you have; log size in Appliances.",
  "safety": "",
  "done": []
 },
 {
  "id": "spring-endheat",
  "season": "Spring",
  "title": "End-of-season boiler shutdown checklist",
  "rule": {
   "type": "yearly"
  },
  "start": "2027-04-25",
  "time": "30 min",
  "tools": "Notebook",
  "why": "Some techs recommend a final flush and leaving the boiler filled to level to limit corrosion.",
  "how": "Follow your tech's instructions on summer layup. Note problems for service call.",
  "safety": "",
  "done": []
 },
 {
  "id": "spring-sump",
  "season": "Spring",
  "title": "Test sump pump",
  "rule": {
   "type": "yearly"
  },
  "start": "2027-03-15",
  "time": "15 min",
  "tools": "Bucket of water",
  "why": "Spring snowmelt and rain are peak sump season.",
  "how": "Pour water into the pit until float lifts pump; confirm it discharges and the check valve works. Clean inlet screen.",
  "safety": "Unplug before handling.",
  "done": []
 },
 {
  "id": "spring-roof",
  "season": "Spring",
  "title": "Inspect roof and flashing from the ground",
  "rule": {
   "type": "yearly"
  },
  "start": "2027-04-10",
  "time": "30 min",
  "tools": "Binoculars",
  "why": "Winter damage shows up as lifted shingles or failed flashing.",
  "how": "Scan for missing or curled shingles, chimney flashing, and gutter sag. Photo for Systems.",
  "safety": "",
  "done": []
 },
 {
  "id": "spring-exterior",
  "season": "Spring",
  "title": "Exterior walk-around: siding, paint, caulk, foundation",
  "rule": {
   "type": "yearly"
  },
  "start": "2027-04-17",
  "time": "1 hr",
  "tools": "Screwdriver (probe for rot), caulk",
  "why": "Catch rot and gaps early.",
  "how": "Probe wood trim, re-caulk, note paint failures. Pre-1978 paint: use lead-safe methods.",
  "safety": "Lead-safe practices.",
  "done": []
 },
 {
  "id": "spring-ac",
  "season": "Spring",
  "title": "Window AC / fan prep",
  "rule": {
   "type": "yearly"
  },
  "start": "2027-05-10",
  "time": "30 min",
  "tools": "Vacuum, fin comb",
  "why": "Clean units cool better and use less power.",
  "how": "Clean filters and coils before install.",
  "safety": "",
  "done": []
 },
 {
  "id": "summer-dryer",
  "season": "Summer",
  "title": "Clean dryer vent",
  "rule": {
   "type": "yearly"
  },
  "start": "2027-06-15",
  "time": "45 min",
  "tools": "Vent brush kit, drill",
  "why": "Lint buildup is a leading cause of house fires.",
  "how": "Disconnect duct, brush the full length, vacuum, reattach with foil tape (not screws).",
  "safety": "Unplug dryer.",
  "done": []
 },
 {
  "id": "summer-paint",
  "season": "Summer",
  "title": "Exterior paint and big outdoor projects",
  "rule": {
   "type": "yearly"
  },
  "start": "2027-06-01",
  "time": "varies",
  "tools": "See project plan",
  "why": "Dry, warm weather window for exterior work.",
  "how": "Pull from Project Pile; sequence by dependency.",
  "safety": "",
  "done": []
 },
 {
  "id": "summer-dehumid",
  "season": "Summer",
  "title": "Basement moisture check",
  "rule": {
   "type": "yearly"
  },
  "start": "2027-07-01",
  "time": "15 min",
  "tools": "Hygrometer",
  "why": "Humid summers drive mold in basements.",
  "how": "Keep basement below about 60% RH; run dehumidifier, empty or plumb drain.",
  "safety": "",
  "done": []
 },
 {
  "id": "summer-gutters",
  "season": "Summer",
  "title": "Check grading and downspout discharge",
  "rule": {
   "type": "yearly"
  },
  "start": "2027-07-15",
  "time": "20 min",
  "tools": "Hose",
  "why": "Water near the foundation is the top cause of wet basements.",
  "how": "Run a hose or watch rain; confirm water flows away from the house.",
  "safety": "",
  "done": []
 },
 {
  "id": "any-bath-caulk",
  "season": "Year-round",
  "title": "Check tub/shower caulk and spout",
  "rule": {
   "type": "monthly",
   "interval": 6
  },
  "start": "2026-10-25",
  "time": "15 min",
  "tools": "Caulk, utility knife",
  "why": "Failed caulk leaks into walls; tub spout diverter wear shows up as shower dribble.",
  "how": "Inspect caulk and spout joint; recaulk as needed.",
  "safety": "",
  "done": []
 },
 {
  "id": "any-waterheater",
  "season": "Year-round",
  "title": "Water heater flush and T&P check",
  "rule": {
   "type": "yearly"
  },
  "start": "2026-11-20",
  "time": "1 hr",
  "tools": "Hose, bucket",
  "why": "Sediment shortens heater life.",
  "how": "Follow manual for flush; test T&P valve lever briefly if the manual says to.",
  "safety": "Hot water.",
  "done": []
 },
 {
  "id": "any-warranty",
  "season": "Year-round",
  "title": "Review warranty expirations",
  "rule": {
   "type": "yearly"
  },
  "start": "2026-12-01",
  "time": "15 min",
  "tools": "House Bible > Warranties",
  "why": "File claims before coverage lapses.",
  "how": "Scan Warranties note for items ending in next 90 days.",
  "safety": "",
  "done": []
 }
];
