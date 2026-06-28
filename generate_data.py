#!/usr/bin/env python3
"""Generate schedule-data.json for the One More app."""
import json, os
from datetime import datetime, timedelta

def add_days(date_str, n):
    d = datetime.strptime(date_str, "%Y-%m-%d") + timedelta(days=n)
    return d.strftime("%Y-%m-%d")

def end_of_week(start):
    return add_days(start, 6)

def day_of_week(date_str):
    return datetime.strptime(date_str, "%Y-%m-%d").weekday()  # 0=Mon

# ============================================================
WEEKS = [
    {"num":1,  "phase":"Phase 1 — Base & Endurance", "focus":"Base — First Step (30 mi)", "start":"2026-06-22", "miles":30},
    {"num":2,  "phase":"Phase 1 — Base & Endurance", "focus":"Base — Volume Push", "start":"2026-06-29", "miles":33},
    {"num":3,  "phase":"Phase 1 — Base & Endurance", "focus":"Base — Cutback", "start":"2026-07-06", "miles":30},
    {"num":4,  "phase":"Phase 1 — Base & Endurance", "focus":"Base→Build — Long Run Opens", "start":"2026-07-13", "miles":36},
    {"num":5,  "phase":"Phase 2 — LT + Mileage Build", "focus":"LT Build — Volume Rising", "start":"2026-07-20", "miles":40},
    {"num":6,  "phase":"Phase 2 — LT + Mileage Build", "focus":"LT Build — Midweek Long Grows", "start":"2026-07-27", "miles":44},
    {"num":7,  "phase":"Phase 2 — LT + Mileage Build", "focus":"LT Build — Cutback", "start":"2026-08-03", "miles":39},
    {"num":8,  "phase":"Phase 2 — LT + Mileage Build", "focus":"LT Build — Major Push", "start":"2026-08-10", "miles":48},
    {"num":9,  "phase":"Phase 2 — LT + Mileage Build", "focus":"LT Build — Consolidate", "start":"2026-08-17", "miles":54},
    {"num":10, "phase":"Phase 2 — LT + Mileage Build", "focus":"LT Build — First MP Run", "start":"2026-08-24", "miles":60},
    {"num":11, "phase":"Phase 2 — LT + Mileage Build", "focus":"Approaching Peak", "start":"2026-08-31", "miles":66},
    {"num":12, "phase":"Phase 2 — LT + Mileage Build", "focus":"Final Pre-Peak Build", "start":"2026-09-07", "miles":72},
    {"num":13, "phase":"Phase 3 — Peak + Race Specificity", "focus":"Peak Week #1 — 80 mi", "start":"2026-09-14", "miles":80},
    {"num":14, "phase":"Phase 3 — Peak + Race Specificity", "focus":"Peak Week #2 — 80 mi", "start":"2026-09-21", "miles":80},
    {"num":15, "phase":"Phase 3 — Peak + Race Specificity", "focus":"Peak Week #3 — 80 mi", "start":"2026-09-28", "miles":80},
    {"num":16, "phase":"Phase 4 — Taper", "focus":"Taper 1 — Cut 25%", "start":"2026-10-05", "miles":60},
    {"num":17, "phase":"Phase 4 — Taper", "focus":"Taper 2 — Cut 40%", "start":"2026-10-12", "miles":48},
    {"num":18, "phase":"Phase 4 — Taper", "focus":"Taper 3 — Cut 57%", "start":"2026-10-19", "miles":34},
    {"num":19, "phase":"Phase 4 — Taper", "focus":"Race Week → RACE DAY", "start":"2026-10-26", "miles":16},
]

# [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
DAILY_MILES = {
    1:  [3, 5.5, 3, 5.5, 3, 0, 10],
    2:  [3, 5.5, 4, 6.5, 3, 0, 11],
    3:  [3, 4.5, 5, 5.5, 3, 0, 9],
    4:  [3, 6, 5.5, 6.5, 3, 0, 12],
    5:  [4, 6, 5.5, 7.5, 3, 0, 14],
    6:  [4.5, 6, 7.5, 8, 3, 0, 15],
    7:  [4.5, 5, 7, 6.5, 3, 0, 13],
    8:  [6, 6, 7, 9, 4, 0, 16],
    9:  [6, 7, 10, 10, 4, 0, 17],
    10: [7.5, 6.5, 11, 13, 4, 0, 18],
    11: [9, 7, 14, 11, 5, 0, 20],
    12: [13, 5.5, 15, 11.5, 6, 0, 21],
    13: [14.5, 7, 15, 15, 6.5, 0, 22],
    14: [15.5, 7.5, 15, 13.5, 6.5, 0, 22],
    15: [14.5, 7, 15, 17, 6.5, 0, 20],
    16: [9.5, 4.5, 14, 9, 5, 0, 18],
    17: [7, 4, 11, 8, 4, 0, 14],
    18: [5, 3.5, 4.5, 5, 4, 0, 12],
    19: [5, 3, 5, 3, 0, 0, 26.2],
}

TRACK = {
    1:"1.5mi w-up + 6×800m @ 6:35–6:40/mi (jog rest) + 1mi c-down — VO2max, 5K effort",
    2:"1.5mi w-up + 5×1000m @ 6:35–6:40/mi (jog rest) + 1mi c-down — VO2max, 5K effort",
    3:"1.5mi w-up + 8×400m @ 6:35–6:40/mi (jog rest) + 1mi c-down — VO2max, 5K effort",
    4:"1.5mi w-up + 5×1200m @ 6:35–6:40/mi (jog rest) + 1mi c-down — VO2max, 5K effort",
    5:"1.5mi w-up + 6×1000m @ 6:05–6:10/mi (jog rest) + 1mi c-down — VO2max, 5K effort",
    6:"1.5mi w-up + 5×1200m @ 6:05–6:10/mi (jog rest) + 1mi c-down — VO2max, 5K effort",
    7:"1.5mi w-up + 10×400m @ 6:05–6:10/mi (jog rest) + 1mi c-down — VO2max, 5K effort",
    8:"1.5mi w-up + 5×1200m @ 6:05–6:10/mi (jog rest) + 1mi c-down — VO2max, 5K effort",
    9:"2mi w-up + 4×1600m @ 6:05–6:10/mi (jog rest) + 1mi c-down — VO2max, 5K effort",
    10:"2mi w-up + 6×1000m @ 6:05–6:10/mi (jog rest) + 1mi c-down — VO2max, 5K effort",
    11:"2mi w-up + 4×1600m @ 6:05/mi (jog rest) + 1mi c-down — VO2max, 5K effort",
    12:"2mi w-up + 8×400m @ 6:05/mi (jog rest) + 1.5mi c-down — VO2max, 5K effort",
    13:"2mi w-up + 5×1200m @ 6:05/mi (jog rest) + 1.5mi c-down — VO2max, 5K effort",
    14:"2mi w-up + 4×1600m @ 6:05/mi (jog rest) + 1.5mi c-down — VO2max, 5K effort",
    15:"2mi w-up + 6×1000m @ 6:05/mi (jog rest) + 1.5mi c-down — VO2max, 5K effort",
    16:"1.5mi w-up + 8×400m @ 6:05/mi (jog rest) + 1mi c-down — VO2max, 5K effort",
    17:"1.5mi w-up + 6×400m @ 6:05/mi (jog rest) + 1mi c-down — VO2max, 5K effort",
    18:"1.5mi w-up + 4×400m @ 6:05/mi (jog rest) + 1mi c-down — VO2max, 5K effort",
    19:"1mi jog + 4×200m @ 5:45/mi (full rest) + 1mi jog — Wake the legs.",
}

TEMPO = {
    1:"1.5mi w-up + 3mi tempo @ 7:00–7:08/mi + 1mi c-down — LT effort",
    2:"1.5mi w-up + 4mi tempo @ 7:00–7:08/mi + 1mi c-down — LT effort",
    3:"1.5mi w-up + 3mi tempo @ 7:00–7:08/mi + 1mi c-down — LT effort",
    4:"1.5mi w-up + 4mi tempo @ 7:00–7:08/mi + 1mi c-down — LT effort",
    5:"1.5mi w-up + 5mi tempo @ 6:37/mi + 1mi c-down — LT effort",
    6:"2mi w-up + 5mi tempo @ 6:37/mi + 1mi c-down — LT effort",
    7:"1.5mi w-up + 4mi tempo @ 6:37/mi + 1mi c-down — LT effort",
    8:"2mi w-up + 6mi tempo @ 6:37/mi + 1mi c-down — LT effort",
    9:"2mi w-up + 7mi tempo @ 6:37/mi + 1mi c-down — LT effort",
    10:"3mi easy + 8mi @ GMP (7:00/mi) + 2mi easy — marathon-pace",
    11:"2mi w-up + 8mi tempo @ 6:33–6:35/mi + 1mi c-down — LT effort",
    12:"2mi w-up + 8mi tempo @ 6:33–6:35/mi + 1.5mi c-down — LT effort",
    13:"3mi easy + 10mi @ GMP (7:00/mi) + 2mi easy — marathon-pace",
    14:"2mi w-up + 10mi tempo @ 6:33–6:35/mi + 1.5mi c-down — LT effort",
    15:"3mi easy + 12mi @ GMP (7:00/mi) + 2mi easy — marathon-pace",
    16:"2mi w-up + 6mi tempo @ 6:33–6:35/mi + 1mi c-down — LT effort",
    17:"2mi easy + 4mi @ GMP (7:00/mi) + 2mi easy — marathon-pace",
    18:"2mi easy + 2mi @ GMP (7:00/mi) + 1mi easy — marathon-pace",
    19:"Very easy 20–25 min jog — Optional, skip if tired.",
}

LONG = {
    1:"Long run @ 8:45–9:15/mi",2:"Long run @ 8:45–9:15/mi",3:"Long run @ 8:45–9:15/mi",4:"Long run @ 8:45–9:15/mi",
    5:"Long run @ 8:00–8:30/mi",6:"Long run @ 8:00–8:30/mi",7:"Long run @ 8:00–8:30/mi",
    8:"Long run @ 8:00–8:30/mi — last miles at faster end",9:"Long run @ 8:00–8:30/mi — last miles at faster end",
    10:"Long run @ 8:00–8:30/mi — last miles at faster end",
    11:"Long run @ 7:40–8:05/mi — last miles at faster end",12:"Long run @ 7:40–8:05/mi — last miles at faster end",
    13:"Long run @ 7:40–8:05/mi — last miles at faster end",14:"Long run @ 7:40–8:05/mi — last miles at faster end",
    15:"Long run @ 7:40–8:05/mi — last miles at faster end",16:"Long run @ 7:40–8:05/mi — last miles at faster end",
    17:"Long run @ 7:40–8:05/mi — last miles at faster end",18:"Long run @ 7:40–8:05/mi — last miles at faster end",
    19:"Marathon — Nov 1, 2026 — Goal Sub 3:04 (7:00/mi). Go out even. Miles 1–13 should feel almost easy. Trust the training.",
}

import re
def parse_splits(desc):
    splits = []
    m = re.search(r'(\d+)×(\d+m?)\s*@\s*([^\s(]+(?:/mi)?)', desc)
    if m:
        splits.append({"reps":int(m.group(1)),"distLabel":m.group(2),"tag":"VO2max","target":m.group(3) if '/mi' in m.group(3) else m.group(3)+'/mi'})
        return splits
    m = re.search(r'(\d+)mi\s*@\s*GMP\s*\(([^)]+)\)', desc)
    if m:
        splits.append({"reps":1,"distLabel":f"{m.group(1)}mi GMP","tag":"GMP","target":m.group(2)})
        return splits
    m = re.search(r'(\d+)mi\s*tempo\s*@\s*([^\s+]+)', desc)
    if m:
        splits.append({"reps":1,"distLabel":f"{m.group(1)}mi tempo","tag":"LT","target":m.group(2) if '/mi' in m.group(2) else m.group(2)+'/mi'})
        return splits
    return splits

# Lift templates
LIFT_LOWER_STR = {
    "label":"Lower — Strength + Power","muscle":"Legs · Power","note":"",
    "exercises":[
        {"name":"Box Jumps (step down, reset each rep)","sets":"4","reps":"3","rpe":"—","note":"POWER FIRST. Quality only — never chase fatigue."},
        {"name":"Back Squat","sets":"4","reps":"5","rpe":"2–3","note":"Main strength lift. Heavy but leave 2–3 in the tank."},
        {"name":"Bulgarian Split Squat (DB)","sets":"3","reps":"8/leg","rpe":"2–3","note":"Single-leg, running-specific."},
        {"name":"Romanian Deadlift","sets":"3","reps":"8–10","rpe":"2","note":"Hamstring/glute. Push hips back."},
        {"name":"Standing Calf Raise (heavy)","sets":"4","reps":"8–10","rpe":"1–2","note":"Plantarflexor strength. Full stretch at bottom."},
        {"name":"Tibialis Raises","sets":"3","reps":"15–20","rpe":"1","note":"Shin-splint insurance."},
    ]
}
CORE_LOWER_STR = {"label":"Core Circuit","duration":"6 min","subtitle":"Hip flexor + abs","exercises":["Hanging Leg Raises ×12"]}

LIFT_PUSH = {
    "label":"Push — Aesthetics","muscle":"Chest · Shoulders · Triceps","note":"",
    "exercises":[
        {"name":"Barbell Bench Press","sets":"4","reps":"6–8","rpe":"2","note":"Chest anchor."},
        {"name":"Incline DB Press","sets":"3","reps":"8–10","rpe":"1–2","note":"Upper chest."},
        {"name":"Chest Fly (cable or pec-deck)","sets":"3","reps":"12–15","rpe":"1","note":"Constant-tension stretch."},
        {"name":"Seated DB Shoulder Press","sets":"3","reps":"8–10","rpe":"1–2","note":"Front-delt mass."},
        {"name":"Lateral Raises (cable or DB)","sets":"4","reps":"12–20","rpe":"0–1","note":"Capped shoulders. Last set to failure."},
        {"name":"Skull Crushers (EZ-bar or DB)","sets":"3","reps":"10","rpe":"1","note":"Triceps long head."},
        {"name":"Triceps Pushdown (cable or overhead DB)","sets":"3","reps":"12–15","rpe":"0–1","note":"Elbows pinned. Last set to failure."},
    ]
}
CORE_PUSH = {"label":"Core Circuit","duration":"4 min","subtitle":"Anti-extension","exercises":["Weighted Plank 30–45s"]}

LIFT_LOWER_POST = {
    "label":"Lower — Posterior + Hypertrophy","muscle":"Legs · Posterior · Glutes","note":"",
    "exercises":[
        {"name":"Trap-Bar Deadlift (or Conventional)","sets":"4","reps":"5","rpe":"2–3","note":"Posterior-chain strength."},
        {"name":"Front Squat (or Hack Squat)","sets":"3","reps":"8","rpe":"2","note":"Quad-biased."},
        {"name":"Hip Thrust","sets":"3","reps":"10","rpe":"1–2","note":"Glute power for push-off."},
        {"name":"Seated Leg Curl (or lying)","sets":"3","reps":"12","rpe":"1","note":"Direct hamstring size."},
        {"name":"Walking Lunges (DB)","sets":"3","reps":"12/leg","rpe":"2","note":"Single-leg quad/glute."},
        {"name":"Seated Calf Raise","sets":"3","reps":"15","rpe":"1","note":"Targets the soleus."},
    ]
}
CORE_LOWER_POST = {"label":"Core Circuit","duration":"5 min","subtitle":"Progressive overload abs","exercises":["Weighted Crunch ×12–15"]}

LIFT_PULL = {
    "label":"Pull — Aesthetics","muscle":"Back · Rear Delts · Biceps","note":"",
    "exercises":[
        {"name":"Pull-Ups (or Lat Pulldown)","sets":"4","reps":"6–10","rpe":"2","note":"V-taper width."},
        {"name":"Chest-Supported Row","sets":"4","reps":"8–12","rpe":"1–2","note":"Mid-back thickness + posture."},
        {"name":"Single-Arm DB Row","sets":"3","reps":"10–12/side","rpe":"1–2","note":"Lat stretch + unilateral balance."},
        {"name":"Rear Delt Flies (DB or reverse pec-deck)","sets":"3","reps":"15","rpe":"0–1","note":"Rear delts = posture + 3D shoulder."},
        {"name":"Face Pulls (cable or band)","sets":"3","reps":"15–20","rpe":"0–1","note":"Shoulder health."},
        {"name":"Incline DB Curls","sets":"3","reps":"10–12","rpe":"1","note":"Bicep long head."},
        {"name":"Hammer / Preacher Curl","sets":"3","reps":"10–12","rpe":"0–1","note":"Last set to failure."},
    ]
}
CORE_PULL = {"label":"Core Circuit","duration":"5 min","subtitle":"Progressive overload abs","exercises":["Weighted Crunch ×12–15"]}

LIFT_DUR = {
    "label":"Athlete / Durability","muscle":"Injury Prevention · Plyos · Stability",
    "note":"Low leg fatigue by design. Never skip Nordics + Copenhagen.",
    "exercises":[
        {"name":"A-Skips + Pogo Hops","sets":"3","reps":"20m / 20 reps","rpe":"—","note":"Plyo warm-up."},
        {"name":"Lateral Bound (skater)","sets":"3","reps":"6/side","rpe":"2–3","note":"Frontal-plane strength."},
        {"name":"Nordic Hamstring Curl (band-assist if needed)","sets":"3","reps":"6","rpe":"1–2","note":"Best hamstring-strain preventer."},
        {"name":"Copenhagen Adductor Plank","sets":"3","reps":"15–25s/side","rpe":"—","note":"Groin/adductor strength."},
        {"name":"Lateral Lunge (DB)","sets":"3","reps":"10/side","rpe":"2","note":"Side-to-side strength."},
        {"name":"Single-Leg Calf Raise","sets":"3","reps":"12/leg","rpe":"1","note":"Per-leg balance."},
    ]
}
CORE_DUR = {"label":"Core Circuit","duration":"6 min","subtitle":"Anti-rotation + lateral","exercises":["Pallof Press ×12/side","Side Plank 30–45s/side"]}

LIFTS = [LIFT_LOWER_STR, LIFT_PUSH, LIFT_LOWER_POST, LIFT_PULL, LIFT_DUR]
CORES = [CORE_LOWER_STR, CORE_PUSH, CORE_LOWER_POST, CORE_PULL, CORE_DUR]

def get_macros(wk):
    if wk <= 4:  return {"protein":"176 g","carbs":"365 g","fat":"70 g","calories":2800}
    if wk <= 12: return {"protein":"176 g","carbs":"470 g","fat":"70 g","calories":3200}
    if wk <= 15: return {"protein":"176 g","carbs":"650 g","fat":"70 g","calories":3950}
    return {"protein":"176 g","carbs":"455 g","fat":"70 g","calories":3150}

CARB_NOTES = {
    "hard_run":"Hard session — maximize glycogen. Carb-forward dinner tonight.",
    "hard_lift":"Lift day — fuel the session. Moderate-high starch.",
    "easy":"Easy day — moderate starch.",
    "rest":"Rest day — lowest carbs. But dinner is pre-fuel for tomorrow."
}

SLEEP = {
    "hard_run":{"duration":"8–8.5h","wake":"5:45 AM","bed":"9:30 PM","runStart":"6:00 AM","note":"Early for quality session."},
    "hard_lift":{"duration":"8h","wake":"6:00 AM","bed":"10:00 PM","runStart":"6:15 AM","note":"Fuel the evening lift well."},
    "easy":{"duration":"8h","wake":"6:30 AM","bed":"10:30 PM","runStart":"6:45 AM","note":""},
    "rest":{"duration":"8–9h","wake":"7:00 AM","bed":"10:00 PM","runStart":"","note":"True recovery."},
}

MEALS = {
    "hard_run":[
        {"phase":"Post-run breakfast","text":"~45g protein + 60–80g carbs: oats + whey + berries, or eggs + toast + smoothie"},
        {"phase":"Lunch","text":"~45g protein: chicken (200g) + 2 cups rice + veg + olive oil"},
        {"phase":"Pre-lift snack","text":"~25g protein: Greek yogurt + granola + honey"},
        {"phase":"Dinner + bedtime","text":"~45g protein + 30g casein: salmon/beef + potato + greens + casein shake"},
    ],
    "hard_lift":[
        {"phase":"Post-run breakfast","text":"~45g protein + 50g carbs: oats + whey + fruit"},
        {"phase":"Lunch","text":"~45g protein: chicken + rice + veg"},
        {"phase":"Pre-lift snack","text":"~25g protein: Greek yogurt + granola"},
        {"phase":"Dinner + bedtime","text":"~45g protein + 30g casein: lean meat + potato + greens + casein shake"},
    ],
    "easy":[
        {"phase":"Post-run breakfast","text":"~40g protein + moderate carbs: eggs + toast or oats + whey"},
        {"phase":"Lunch","text":"~45g protein: chicken/fish + rice + veg"},
        {"phase":"Afternoon snack","text":"~20g protein: Greek yogurt or protein bar"},
        {"phase":"Dinner + bedtime","text":"~45g protein + 30g casein: meat + potato/rice + greens + casein"},
    ],
    "rest":[
        {"phase":"Breakfast","text":"~40g protein: eggs + light toast or yogurt bowl"},
        {"phase":"Lunch","text":"~45g protein: chicken/fish + moderate carbs + veg"},
        {"phase":"Dinner (carb-forward for tomorrow)","text":"~45g protein: meat + pasta/rice/potato + greens"},
        {"phase":"Evening snack","text":"~30g casein: casein shake or cottage cheese"},
    ],
}

DAILY_SUPPS = [
    {"name":"Creatine monohydrate","dose":"3–5 g","timing":"Any time, daily","note":"Micronized monohydrate."},
    {"name":"Vitamin D3","dose":"1,000–2,000 IU","timing":"With food, daily","note":"Bone + immune support."},
    {"name":"Omega-3 (fish oil)","dose":"1–2 g EPA/DHA","timing":"With food","note":"Recovery/anti-inflammatory."},
]

def get_guidance(wk, dow, cat):
    macros = get_macros(wk)
    macros["carbNote"] = CARB_NOTES.get(cat, CARB_NOTES["easy"])
    sleep = dict(SLEEP.get(cat, SLEEP["easy"]))
    if dow == 6:
        sleep = {"duration":"8.5h","wake":"5:30 AM","bed":"9:00 PM","runStart":"6:00 AM","note":"Big day. Carry fuel."}
    meals = list(MEALS.get(cat, MEALS["easy"]))
    supps = list(DAILY_SUPPS)
    if cat == "hard_run":
        supps.append({"name":"Caffeine","dose":"200–300 mg","timing":"45–60 min pre-run","note":"Reserve for quality sessions."})
        if dow == 6:
            supps.append({"name":"Beetroot / dietary nitrate","dose":"400–500 mg nitrate","timing":"2–3 hr pre-run","note":"Endurance economy benefit."})
    hydration = "3–4 L daily. Long run: carry fluid + electrolytes + 300–700 mg sodium/hr." if dow == 6 else "3–4 L fluid total. Urine pale-straw."
    return {"category":cat,"sleep":sleep,"macros":macros,"meals":meals,"supplements":supps,"hydration":hydration}

def get_run(wk, dow):
    """dow: 0=Mon..6=Sun (Python weekday)"""
    ep = "9:00–9:20/mi — Zone 2" if wk <= 4 else ("8:20–8:45/mi — Zone 2" if wk <= 12 else "8:15–8:35/mi — Zone 2")
    rp = "9:30–10:00/mi — Zone 1" if wk <= 4 else "8:45–9:15/mi — Zone 1"

    if dow == 0:  # Mon
        if wk == 19: return ("General Aerobic","General Aerobic + Strides","Easy @ 8:15–8:45/mi + 4×100m strides — Stay loose.")
        return ("General Aerobic","General Aerobic",f"General aerobic @ {ep}")
    if dow == 1:  # Tue
        if wk == 19: return ("Track","Shakeout Strides",TRACK[wk])
        return ("Track","Track / VO2max",TRACK[wk])
    if dow == 2:  # Wed
        lp = "8:45–9:15/mi" if wk <= 4 else ("8:00–8:30/mi" if wk <= 10 else "7:40–8:05/mi")
        if wk == 19: return ("MP Run","GMP Confirmation","2mi easy + 2mi @ GMP (7:00/mi) + 1mi easy — Final 7:00 confirmation.")
        return ("Medium-Long","Medium-Long",f"Medium-long run @ {lp} — Zone 2")
    if dow == 3:  # Thu
        if wk == 19: return ("Recovery","Recovery Jog",TEMPO[wk])
        title = "Marathon Pace" if wk in (10,13,15,17,18) else "Tempo / LT"
        return ("Tempo / LT",title,TEMPO[wk])
    if dow == 4:  # Fri
        if wk == 19: return ("Rest","Rest","Full rest — carb load, lay out gear, sleep early")
        return ("Recovery","Recovery",f"Recovery run @ {rp}")
    if dow == 5:  # Sat
        if wk == 19: return ("Rest","Rest","Full rest — final prep, short shakeout walk only")
        return ("Rest","Rest Day","Full rest day")
    if dow == 6:  # Sun
        if wk == 19: return ("Race","🏁 NYC Marathon",LONG[wk])
        return ("Long Run","Long Run",LONG[wk])

# Build workouts
import copy
workouts = []
for wk in WEEKS:
    miles = DAILY_MILES[wk["num"]]
    for dow in range(7):
        date = add_days(wk["start"], dow)
        mi = miles[dow]
        is_rest = (dow == 5 and wk["num"] != 19) or (wk["num"] == 19 and dow == 4 and mi == 0) or (wk["num"] == 19 and dow == 5)
        is_race = wk["num"] == 19 and dow == 6
        wed_dropped = dow == 2 and 13 <= wk["num"] <= 15

        rt, title, desc = get_run(wk["num"], dow)
        cat = "rest" if is_rest else ("hard_run" if dow in (1,6) or (dow==3 and wk["num"]<19) else ("hard_lift" if (dow==0) or (dow==2 and wk["num"]<13) else "easy"))

        wo = {
            "date": date, "week": wk["num"], "phase": wk["phase"], "focus": wk["focus"],
            "type": "rest" if is_rest else "run", "runType": rt, "title": title,
            "miles": mi, "isRace": is_race, "wedDropped": wed_dropped,
            "run": {"description": desc, "splits": parse_splits(desc)},
            "guidance": get_guidance(wk["num"], dow, cat),
        }

        if not is_rest and wk["num"] < 19 and dow <= 4 and not wed_dropped:
            wo["lift"] = copy.deepcopy(LIFTS[dow])
            wo["core"] = copy.deepcopy(CORES[dow])

        if is_rest:
            rest_desc = "Full rest day. No running. Recover for tomorrow." if dow == 5 else desc
            wo["run"] = {"description": rest_desc, "splits": []}

        workouts.append(wo)

pace_ref = [
    {"type":"GMP (Marathon Pace)","pace":"7:00/mi","hr":"Z3–4 (162–175 bpm)","notes":"Race pace"},
    {"type":"Tempo / LT (early Wks 1–4)","pace":"7:00–7:08/mi","hr":"High Z3 / low Z4","notes":"~1-hr race effort"},
    {"type":"Tempo / LT (mid Wks 5–10)","pace":"6:37/mi","hr":"High Z3 / low Z4","notes":"LT pace, not harder"},
    {"type":"Tempo / LT (peak Wks 11–18)","pace":"6:33–6:35/mi","hr":"High Z3 / low Z4","notes":"LT rising"},
    {"type":"Track / VO2max (early)","pace":"6:35–6:40/mi","hr":"Z4–5 (171–189 bpm)","notes":"5K effort"},
    {"type":"Track / VO2max (mid–peak)","pace":"6:05–6:10/mi","hr":"Z4–5","notes":"5K effort — don't exceed"},
    {"type":"Easy / General Aerobic","pace":"8:15–8:45/mi","hr":"Z2 (140–154 bpm)","notes":"Conversational"},
    {"type":"Recovery","pace":"8:45–10:00/mi","hr":"Z1–low Z2","notes":"Noticeably slower than all else"},
    {"type":"Long Run (early)","pace":"8:45–9:15/mi","hr":"Z2","notes":"Build to Z3 in final miles"},
    {"type":"Long Run (mid–late)","pace":"7:40–8:30/mi","hr":"Z2–3","notes":"Fast finish last 5–8 mi"},
]

schedule_data = {
    "meta": {
        "goal":"Sub 3:04 (7:00/mi)","race":"NYC Marathon","raceDate":"2026-11-01",
        "start":"2026-06-22","methodology":"Pfitzinger & Douglas — 19-week, 30→80 mpw",
        "generated":"2026-06-27","nutrition":"2.0 g/kg protein, carbs flex by phase"
    },
    "paceRef": pace_ref,
    "weeks": [{"num":w["num"],"phase":w["phase"],"focus":w["focus"],"start":w["start"],"end":end_of_week(w["start"]),"miles":w["miles"]} for w in WEEKS],
    "workouts": workouts,
}

os.makedirs("src/data", exist_ok=True)
with open("src/data/schedule-data.json", "w") as f:
    json.dump(schedule_data, f, indent=2)
print(f"schedule-data.json: {len(workouts)} workouts, {len(WEEKS)} weeks")

# Validate
for wk in WEEKS:
    s = sum(DAILY_MILES[wk["num"]])
    if wk["num"] < 19 and abs(s - wk["miles"]) > 0.1:
        print(f"  WARNING: Week {wk['num']}: planned {wk['miles']} mi, sum = {s}")
print(f"Dates: {workouts[0]['date']} → {workouts[-1]['date']}")
