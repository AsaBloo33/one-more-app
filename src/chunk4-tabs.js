// ============================================================
// Chunk 4 — Tracker, Weekly, Recovery tabs
// Plain function declarations. Spliced into the main IIFE scope.
// All closured helpers (DATA, BY_DATE, ALL_DATES, RACE, LOGS,
// PREFS, CHECKS, WEIGHTS, RECOVERY, FOOD, SYNC, BACKEND_URL,
// DATA_TOKEN, TODAY, SELECTED, stripWeek, activeTab, recSelected,
// saveLogs, savePrefs, saveChecks, saveWeights, saveRec, saveFood,
// todayStr, clampToday, fmt, dnum, ddow, daysBetween, addDays,
// markType, isDone, weekOf, datesInWeek, esc, parseRepNum,
// parseTime, secToPace, parseSleepHrs, fmtHrs, pct, fmtTon, exKey,
// isChecked, toggleCheck, sectionProgress, checkId,
// macroTargets, foodTotals, switchTab, render, toast, applyTheme,
// closeModal, field, progressRing, barStatus, DOW, MON, FULL_STACK,
// DEVICE_SRCS, isDevice, mergeSynced, pullBackend,
// liftClass, getWeight, weeklyBump  — from Chunk 3)
// are used directly without redeclaration.
// ============================================================

// ------------------------------------------------------------------
// Shared helper (PRD §8.6)
// ------------------------------------------------------------------

function weekMetrics(wkNum) {
  var dates = datesInWeek(wkNum);
  var plannedMi = 0, loggedMi = 0;
  var plannedTon = 0, loggedTon = 0;
  var runsSched = 0, runsDone = 0;
  var recVals = [];

  dates.forEach(function(ds) {
    var w = BY_DATE[ds];
    if (!w) return;

    // --- Running ---
    if (w.type !== 'rest' && w.miles > 0) {
      runsSched++;
      plannedMi += w.miles;
      if (isDone(ds)) {
        runsDone++;
        var log = LOGS[ds];
        var dist = (log && log.run && parseFloat(log.run.dist)) || 0;
        loggedMi += dist > 0 ? dist : w.miles;
      }
    }

    // --- Lifting tonnage ---
    if (w.lift && w.lift.exercises) {
      w.lift.exercises.forEach(function(e) {
        var cls = liftClass(e.name, e.reps);
        if (cls === 'power') return; // not loadable
        var key = exKey(e.name);
        var wt = parseFloat(WEIGHTS[ds + '|' + key]) || 0;
        if (wt <= 0) return;
        var sets = parseInt(e.sets, 10) || 0;
        var reps = parseRepNum(e.reps) || 0;
        var ton = sets * reps * wt;
        plannedTon += ton;
        // logged = manually flagged weight
        if (WEIGHTS[ds + '|' + key + '|man']) {
          loggedTon += ton;
        }
      });
    }

    // --- Recovery ---
    var rec = RECOVERY[ds];
    if (rec && rec.recovery != null && !isNaN(parseFloat(rec.recovery))) {
      recVals.push(parseFloat(rec.recovery));
    }
  });

  var recAvg = recVals.length > 0
    ? Math.round(recVals.reduce(function(s, v) { return s + v; }, 0) / recVals.length)
    : null;

  return {
    wkNum: wkNum,
    plannedMi: plannedMi,
    loggedMi: loggedMi,
    plannedTon: plannedTon,
    loggedTon: loggedTon,
    runsSched: runsSched,
    runsDone: runsDone,
    recAvg: recAvg,
    recCount: recVals.length
  };
}

// ------------------------------------------------------------------
// TRACKER TAB (PRD §7)
// ------------------------------------------------------------------

function recentRunWeeks(curWk, n) {
  var result = [];
  for (var wk = curWk; wk >= 1 && result.length < n; wk--) {
    result.push(weekMetrics(wk));
  }
  return result;
}

function trackerScore() {
  var curWk = weekOf(clampToday());
  var today = clampToday();
  var daysToRace = daysBetween(todayStr(), RACE);

  // ---- Pillar 1: Mileage adherence (weight 0.35) ----
  var weeks = recentRunWeeks(curWk, 4);
  var mPlan = 0, mDone = 0, mQualifying = 0;

  weeks.forEach(function(wm) {
    if (wm.plannedMi <= 0) return;
    var dates = datesInWeek(wm.wkNum);
    var totalDays = dates.length || 7;

    if (wm.wkNum === curWk) {
      // Scale current week by fraction elapsed
      var pastDays = 0;
      dates.forEach(function(d) { if (d <= today) pastDays++; });
      var frac = pastDays / totalDays;
      var scaledPlan = wm.plannedMi * frac;
      var cappedLogged = Math.min(wm.loggedMi, wm.plannedMi * 1.1 * frac);
      mPlan += scaledPlan;
      mDone += cappedLogged;
    } else {
      mPlan += wm.plannedMi;
      mDone += Math.min(wm.loggedMi, wm.plannedMi * 1.1);
    }
    mQualifying++;
  });

  var mP = mQualifying > 0 ? Math.min(100, Math.round(mDone / mPlan * 100)) : null;
  if (mPlan <= 0) mP = null;

  // ---- Pillar 2: Recovery & HRV trend (weight 0.25) ----
  var recEntries = [];
  var allRecDates = Object.keys(RECOVERY).filter(function(d) {
    return d <= today && RECOVERY[d] && RECOVERY[d].recovery != null;
  }).sort();

  allRecDates.forEach(function(d) {
    recEntries.push({ ds: d, recovery: parseFloat(RECOVERY[d].recovery), hrv: RECOVERY[d].hrv });
  });

  var recP = null;
  var hrvDir = null;
  var hrvNote = '';

  if (recEntries.length > 0) {
    // Last 14 entries average
    var last14 = recEntries.slice(-14);
    var recSum = last14.reduce(function(s, e) { return s + e.recovery; }, 0);
    var recAvg = recSum / last14.length;
    recP = Math.max(0, Math.min(100, Math.round(recAvg / 67 * 100)));

    // HRV trend: last 21 entries with HRV
    var hrvEntries = recEntries.filter(function(e) {
      return e.hrv != null && !isNaN(parseFloat(e.hrv));
    }).slice(-21);

    if (hrvEntries.length >= 6) {
      var half = Math.floor(hrvEntries.length / 2);
      var first = hrvEntries.slice(0, half);
      var second = hrvEntries.slice(half);
      var firstMean = first.reduce(function(s, e) { return s + parseFloat(e.hrv); }, 0) / first.length;
      var secondMean = second.reduce(function(s, e) { return s + parseFloat(e.hrv); }, 0) / second.length;
      hrvDir = secondMean - firstMean;
      if (hrvDir > 1) hrvNote = 'HRV trending up';
      else if (hrvDir < -1) hrvNote = 'HRV trending down';
      else hrvNote = 'HRV stable';
    }
  }

  // ---- Pillar 3: Lifting consistency (weight 0.15) ----
  var liftSched = 0, liftDone = 0;

  for (var d = 0; d < 14; d++) {
    var ds = addDays(today, -d);
    var w = BY_DATE[ds];
    if (!w || !w.lift || !w.lift.exercises) continue;

    var hasLoadable = false;
    var hasManual = false;

    w.lift.exercises.forEach(function(e) {
      var cls = liftClass(e.name, e.reps);
      if (cls === 'power') return;
      hasLoadable = true;
      var key = exKey(e.name);
      if (WEIGHTS[ds + '|' + key + '|man']) {
        hasManual = true;
      }
    });

    if (hasLoadable) {
      liftSched++;
      if (hasManual) liftDone++;
    }
  }

  var liftP = liftSched > 0 ? Math.round(liftDone / liftSched * 100) : null;

  // ---- Pillar 4: Ramp vs plan (weight 0.25) ----
  var rampP = null;
  var achieved = 0;
  var curWeekInfo = DATA.weeks ? DATA.weeks.find(function(wk) { return wk.num === curWk; }) : null;
  var expectMi = curWeekInfo ? curWeekInfo.miles : 0;

  if (expectMi > 0) {
    // Max logged miles among elapsed prior weeks
    var elapsedWeeks = weeks.filter(function(wm) { return wm.wkNum < curWk; });
    if (elapsedWeeks.length > 0) {
      elapsedWeeks.forEach(function(wm) {
        if (wm.loggedMi > achieved) achieved = wm.loggedMi;
      });
    } else {
      // No elapsed prior weeks — use current week's logged
      achieved = weeks.length > 0 ? weeks[0].loggedMi : 0;
    }
    rampP = Math.min(100, Math.round(achieved / expectMi * 100));

    // Special case: curWk <= 2, soften to mP
    if (curWk <= 2) {
      rampP = mP;
    }
  }

  // ---- Blend ----
  var pillars = [
    { label: 'Mileage', p: mP, weight: 0.35, note: mP != null ? (mDone.toFixed(1) + '/' + mPlan.toFixed(1) + ' mi (last ' + mQualifying + ' wks)') : 'No mileage data yet' },
    { label: 'Recovery', p: recP, weight: 0.25, note: recP != null ? ('Avg ' + Math.round(recEntries.slice(-14).reduce(function(s, e) { return s + e.recovery; }, 0) / Math.min(recEntries.length, 14)) + '% (last 14)' + (hrvNote ? ' · ' + hrvNote : '')) : 'No recovery data yet' },
    { label: 'Lifting', p: liftP, weight: 0.15, note: liftP != null ? (liftDone + '/' + liftSched + ' days with weights logged') : 'No lift days in range' },
    { label: 'Ramp', p: rampP, weight: 0.25, note: rampP != null ? ('Peak ' + achieved.toFixed(1) + ' mi vs ' + expectMi + ' mi planned') : 'Not enough data' }
  ];

  var activePillars = pillars.filter(function(p) { return p.p != null; });
  var score = null;

  if (activePillars.length > 0) {
    var totalWeight = activePillars.reduce(function(s, p) { return s + p.weight; }, 0);
    var weighted = activePillars.reduce(function(s, p) { return s + p.p * p.weight; }, 0);
    score = Math.round(weighted / totalWeight);
  }

  return {
    score: score,
    pillars: pillars,
    curWk: curWk,
    daysToRace: daysToRace
  };
}

function trackerVerdict(score) {
  if (score == null) return ['none', 'Getting started', 'Start logging workouts and recovery to build your readiness score.'];
  if (score >= 90) return ['on', 'Dialed in', 'Training is clicking. Stay consistent, trust the taper, and keep recovery high.'];
  if (score >= 75) return ['on', 'On track', 'Solid work. Keep hitting the plan and logging your lifts and recovery.'];
  if (score >= 55) return ['near', 'Slightly behind', 'A few gaps in the plan. Focus on consistency this week and prioritize sleep.'];
  if (score >= 35) return ['low', 'Catch-up needed', 'Falling behind in key areas. Prioritize the long run and get recovery back on track.'];
  return ['low', 'Well behind', 'Significant gaps. Focus on getting runs in and building momentum — every day counts.'];
}

function renderTracker() {
  var el = document.getElementById('trackerView');
  var ts = trackerScore();
  var v = trackerVerdict(ts.score);
  var scoreDisplay = ts.score != null ? ts.score : '—';
  var scoreColor = ts.score == null ? 'var(--color-ink-faint)'
    : ts.score >= 75 ? 'var(--color-good)'
    : ts.score >= 55 ? 'var(--color-info)'
    : 'var(--color-warn)';

  // Build hero ring manually for score display
  var r = 16, c = 2 * Math.PI * r;
  var p = ts.score != null ? Math.min(100, ts.score) : 0;
  var offset = c - (p / 100) * c;

  var ringHtml = '<div class="progress-ring progress-ring-xl">' +
    '<svg viewBox="0 0 40 40">' +
    '<circle class="progress-ring-bg" cx="20" cy="20" r="' + r + '"/>' +
    '<circle class="progress-ring-fill" cx="20" cy="20" r="' + r + '" ' +
    'stroke="' + scoreColor + '" ' +
    'stroke-dasharray="' + c + '" ' +
    'stroke-dashoffset="' + offset + '"/>' +
    '</svg>' +
    '<span class="progress-ring-text">' + scoreDisplay + '</span>' +
    '</div>';

  var html = '<p class="text-sm text-muted text-center mb-md">' +
    'How on-track you are for the ' + esc(DATA.meta.race || 'NYC Marathon') +
    ' · ' + (ts.daysToRace > 0 ? ts.daysToRace + ' days out' : ts.daysToRace === 0 ? 'Race day' : 'Race complete') +
    ' · Week ' + ts.curWk + '/19</p>';

  html += '<div class="card">' +
    '<div class="tracker-hero">' +
    ringHtml +
    '<div class="tracker-verdict mt-md">' +
    '<div class="tracker-verdict-title status-' + v[0] + '">' + esc(v[1]) + '</div>' +
    '<p class="tracker-verdict-detail">' + esc(v[2]) + '</p>' +
    '</div>' +
    '</div>' +
    '</div>';

  // Pillar breakdown
  html += '<div class="card">' +
    '<h3 class="mb-md">Readiness Breakdown</h3>';

  ts.pillars.forEach(function(pil) {
    var pVal = pil.p != null ? pil.p : 0;
    var pDisplay = pil.p != null ? pil.p + '%' : '—';
    var status = pil.p != null ? barStatus(pVal) : 'none';
    var wLabel = Math.round(pil.weight * 100) + '%';

    html += '<div class="pillar-row">' +
      '<span class="pillar-label">' + esc(pil.label) + '</span>' +
      '<div class="pillar-bar"><div class="pillar-bar-inner ' + status + '" style="width:' + Math.min(100, pVal) + '%"></div></div>' +
      '<span class="pillar-pct">' + pDisplay + '</span>' +
      '<span class="pillar-weight">&middot;w' + wLabel + '</span>' +
      '</div>';
    html += '<p class="text-sm text-muted" style="margin:-4px 0 8px 100px;padding-left:10px;font-size:11px">' + esc(pil.note) + '</p>';
  });

  html += '</div>';

  // Explanation
  html += '<div class="card">' +
    '<h3 class="mb-sm">What this means</h3>' +
    '<p class="text-sm text-muted">Your readiness score blends four pillars: <strong>Mileage</strong> (35%) tracks weekly run volume vs plan. ' +
    '<strong>Recovery</strong> (25%) uses your recovery % and HRV trend. <strong>Lifting</strong> (15%) measures logged weight entries. ' +
    '<strong>Ramp</strong> (25%) compares your peak recent volume to the current week\'s target. ' +
    'Missing data is excluded — the score reweights across available pillars rather than penalizing gaps.</p>' +
    '</div>';

  el.innerHTML = html;
}

// ------------------------------------------------------------------
// WEEKLY TAB (PRD §8)
// ------------------------------------------------------------------

function miniBar(label, p, sub, cls) {
  var status = cls || barStatus(p);
  return '<div class="mini-bar">' +
    '<div class="mini-bar-header">' +
    '<span class="mini-bar-label">' + label + '</span>' +
    '<span class="mini-bar-value">' + esc(sub) + '</span>' +
    '</div>' +
    '<div class="fill-bar"><div class="fill-bar-inner ' + status + '" style="width:' + Math.min(100, p) + '%"></div></div>' +
    '</div>';
}

function dayAdherence(ds) {
  var w = BY_DATE[ds];
  var result = { ds: ds, w: w };

  // Run
  result.plannedMi = (w && w.type !== 'rest') ? (w.miles || 0) : 0;
  result.loggedMi = 0;
  if (w && isDone(ds)) {
    var log = LOGS[ds];
    var dist = (log && log.run && parseFloat(log.run.dist)) || 0;
    result.loggedMi = dist > 0 ? dist : result.plannedMi;
  }
  result.runP = result.plannedMi > 0 ? pct(result.loggedMi, result.plannedMi) : null;

  // Lift tonnage
  result.plannedTon = 0;
  result.loggedTon = 0;
  if (w && w.lift && w.lift.exercises) {
    w.lift.exercises.forEach(function(e) {
      var cls = liftClass(e.name, e.reps);
      if (cls === 'power') return;
      var key = exKey(e.name);
      var wt = parseFloat(WEIGHTS[ds + '|' + key]) || 0;
      if (wt <= 0) return;
      var sets = parseInt(e.sets, 10) || 0;
      var reps = parseRepNum(e.reps) || 0;
      var ton = sets * reps * wt;
      result.plannedTon += ton;
      if (WEIGHTS[ds + '|' + key + '|man']) {
        result.loggedTon += ton;
      }
    });
  }
  result.liftP = result.plannedTon > 0 ? pct(result.loggedTon, result.plannedTon) : null;

  // Diet
  var tgt = macroTargets(ds);
  var got = foodTotals(ds);
  result.hasDiet = tgt.p > 0;
  result.dietP = result.hasDiet ? pct(got.p, tgt.p) : null;

  return result;
}

function progBar(label, valueText, p, statusOverride) {
  var status = statusOverride || barStatus(p);
  var statusLabels = { on: 'On track', near: 'Slightly behind', low: 'Behind plan', none: 'Nothing logged' };
  return '<div class="mb-md">' +
    '<div class="flex flex-between mb-xs">' +
    '<span class="text-sm" style="font-weight:500">' + label + '</span>' +
    '<span class="text-sm text-muted">' + esc(valueText) + '</span>' +
    '</div>' +
    '<div class="fill-bar"><div class="fill-bar-inner ' + status + '" style="width:' + Math.min(100, p) + '%"></div></div>' +
    '<div class="flex flex-between mt-xs">' +
    '<span class="text-sm text-muted">' + p + '%</span>' +
    '<span class="text-sm status-' + status + '" style="font-size:11px;font-weight:600">' + (statusLabels[status] || '') + '</span>' +
    '</div>' +
    '</div>';
}

function trainingReadout(curWk) {
  var cur = weekMetrics(curWk);
  var priorWeeks = [];
  for (var wk = curWk - 1; wk >= 1 && priorWeeks.length < 3; wk--) {
    var pm = weekMetrics(wk);
    if (pm.recAvg != null) priorWeeks.push(pm);
  }

  // No current recovery data
  if (cur.recAvg == null) {
    return {
      cur: cur,
      baseRec: null,
      verdict: 'Add recovery data',
      vclass: 'none',
      detail: 'Log recovery scores to see your training balance.'
    };
  }

  // No baseline yet
  if (priorWeeks.length === 0) {
    return {
      cur: cur,
      baseRec: null,
      verdict: 'Building baseline',
      vclass: 'info',
      detail: 'Need prior week recovery data to compare against.'
    };
  }

  var baseRec = Math.round(
    priorWeeks.reduce(function(s, wm) { return s + wm.recAvg; }, 0) / priorWeeks.length
  );

  // Load delta
  var prevMi = priorWeeks[0].plannedMi || 1;
  var loadUp = (cur.plannedMi - prevMi) / prevMi;

  var drop = baseRec - cur.recAvg;
  var result = { cur: cur, baseRec: baseRec, verdict: '', vclass: '', detail: '' };

  if (drop >= 10) {
    result.verdict = 'Overreaching — back off';
    result.vclass = 'warn';
    result.detail = 'Recovery dropped ' + drop + ' pts from baseline' +
      (loadUp > 0.02 ? ' while load is climbing. Consider cutting volume this week.' : '. Prioritize sleep and easy days.');
  } else if (drop >= 4) {
    result.verdict = 'Watch the load';
    result.vclass = 'info';
    result.detail = 'Recovery is ' + drop + ' pts below baseline. Monitor closely and prioritize sleep.';
  } else if (cur.recAvg - baseRec >= 8 && loadUp < 0.02) {
    result.verdict = 'Fresh — room to push';
    result.vclass = 'on';
    result.detail = 'Recovery is ' + (cur.recAvg - baseRec) + ' pts above baseline with stable load. You can handle more.';
  } else {
    result.verdict = 'On track';
    result.vclass = 'on';
    result.detail = 'Recovery and training load are balanced. Keep it up.';
  }

  return result;
}

function weeklySummaryCard(wkNum) {
  var m = weekMetrics(wkNum);
  var runP = pct(m.loggedMi, m.plannedMi);
  var tonP = pct(m.loggedTon, m.plannedTon);
  var tr = trainingReadout(wkNum);

  var html = '<div class="card mt-md">' +
    '<h3 class="mb-md">Week ' + wkNum + ' Summary</h3>';

  html += progBar(
    'Running',
    m.loggedMi.toFixed(1) + ' / ' + m.plannedMi.toFixed(1) + ' mi',
    runP
  );

  html += progBar(
    'Weight moved',
    fmtTon(m.loggedTon) + ' / ' + fmtTon(m.plannedTon) + ' lb',
    tonP,
    m.plannedTon === 0 ? 'none' : undefined
  );

  // Training readout
  html += '<div class="divider"></div>' +
    '<div class="flex gap-sm" style="align-items:flex-start">' +
    '<span class="chip ' + tr.vclass + '">' + esc(tr.verdict) + '</span>' +
    '</div>' +
    '<p class="text-sm text-muted mt-xs">' + esc(tr.detail) + '</p>';

  if (tr.baseRec != null) {
    html += '<p class="text-sm text-muted mt-xs" style="font-size:11px">' +
      'Current recovery avg: ' + (tr.cur.recAvg != null ? tr.cur.recAvg + '%' : '—') +
      ' · Baseline: ' + tr.baseRec + '%</p>';
  }

  html += '</div>';
  return html;
}

function renderWeekly() {
  var el = document.getElementById('historyView');
  var today = clampToday();
  var curWk = weekOf(today);
  var wm = weekMetrics(curWk);
  var wkInfo = DATA.weeks ? DATA.weeks.find(function(wk) { return wk.num === curWk; }) : null;
  var focus = wkInfo ? wkInfo.focus : '';

  // Diet totals for the current training week
  var wkDates = datesInWeek(curWk);
  var dietPTarget = 0, dietPGot = 0;
  var dietCTarget = 0, dietCGot = 0;
  wkDates.forEach(function(ds) {
    var tgt = macroTargets(ds);
    var got = foodTotals(ds);
    if (tgt.p > 0) {
      dietPTarget += tgt.p;
      dietPGot += got.p;
      dietCTarget += tgt.c;
      dietCGot += got.c;
    }
  });

  var mileP = pct(wm.loggedMi, wm.plannedMi);
  var tonP = pct(wm.loggedTon, wm.plannedTon);
  var protP = dietPTarget > 0 ? pct(dietPGot, dietPTarget) : 0;
  var carbP = dietCTarget > 0 ? pct(dietCGot, dietCTarget) : 0;

  var html = '<div class="card">' +
    '<h3>This week · Week ' + curWk + '/19' + (focus ? ' · ' + esc(focus) : '') + '</h3>' +
    '<div class="mt-md">' +
    miniBar('🏃 Mileage', mileP, wm.loggedMi.toFixed(1) + ' / ' + wm.plannedMi.toFixed(1) + ' mi') +
    miniBar('🏋️ Lifting', tonP, fmtTon(wm.loggedTon) + ' / ' + fmtTon(wm.plannedTon) + ' lb', wm.plannedTon === 0 ? 'none' : undefined) +
    miniBar('🥩 Protein', protP, Math.round(dietPGot) + ' / ' + Math.round(dietPTarget) + ' g') +
    miniBar('🍞 Carbs', carbP, Math.round(dietCGot) + ' / ' + Math.round(dietCTarget) + ' g') +
    '</div></div>';

  // Rolling 7-day log (newest first)
  html += '<h3 class="mt-md mb-sm" style="padding:0 4px">Last 7 days</h3>';

  for (var i = 0; i < 7; i++) {
    var ds = addDays(today, -i);
    var w = BY_DATE[ds];
    var adh = dayAdherence(ds);
    var isToday = (ds === today);
    var title = w ? (w.title || 'Training') : 'No plan';
    var dayNum = dnum(ds);
    var dayDow = DOW[ddow(ds)];

    // Chips
    var runChipP = adh.runP;
    var liftChipP = adh.liftP;
    var dietChipP = adh.dietP;

    var runChipStatus = runChipP != null ? barStatus(runChipP) : 'none';
    var liftChipStatus = liftChipP != null ? barStatus(liftChipP) : 'none';
    var dietChipStatus = dietChipP != null ? barStatus(dietChipP) : 'none';

    var runChipLabel = runChipP != null ? runChipP + '%' : '—';
    var liftChipLabel = liftChipP != null ? liftChipP + '%' : '—';
    var dietChipLabel = dietChipP != null ? dietChipP + '%' : '—';

    html += '<div class="day-card" data-daycard="' + ds + '">' +
      '<div class="day-card-date">' +
      '<div class="dc-num">' + dayNum + '</div>' +
      '<div class="dc-dow">' + dayDow + '</div>' +
      '</div>' +
      '<div class="day-card-info">' +
      '<div class="day-card-title">' + esc(title) + (w && w.miles ? ' · ' + w.miles + ' mi' : '') + '</div>' +
      (isToday ? '<div class="day-card-today">Today</div>' : '') +
      '</div>' +
      '<div class="day-card-chips">' +
      '<span class="chip ' + runChipStatus + '">🏃 ' + runChipLabel + '</span>' +
      '<span class="chip ' + liftChipStatus + '">🏋️ ' + liftChipLabel + '</span>' +
      '<span class="chip ' + dietChipStatus + '">🥩 ' + dietChipLabel + '</span>' +
      '</div>' +
      '</div>';
  }

  // Weekly summary card
  html += weeklySummaryCard(curWk);

  el.innerHTML = html;

  // Wire day card clicks — navigate to Home tab for that day
  el.querySelectorAll('.day-card[data-daycard]').forEach(function(card) {
    card.addEventListener('click', function() {
      var ds = card.dataset.daycard;
      SELECTED = ds;
      stripWeek = weekOf(ds);
      switchTab('today');
    });
  });
}

// ------------------------------------------------------------------
// RECOVERY TAB (PRD §9)
// ------------------------------------------------------------------

function recColor(v) {
  v = parseFloat(v) || 0;
  if (v >= 67) return 'good';
  if (v >= 34) return 'info';
  return 'warn';
}

function sleepDebt(uptoDs) {
  var SLEEP_NEED = 8.0;
  // Trailing 7 nights with logged sleep
  var nights = [];
  for (var i = 1; i <= 30 && nights.length < 7; i++) {
    var ds = addDays(uptoDs, -i);
    var rec = RECOVERY[ds];
    if (rec && rec.sleep != null) {
      var hrs = parseSleepHrs(rec.sleep);
      if (hrs != null) {
        nights.push(hrs);
      }
    }
  }
  if (nights.length === 0) return { debt: 0, nights: 0 };
  var debt = 0;
  nights.forEach(function(h) {
    debt += Math.max(0, SLEEP_NEED - h);
  });
  return { debt: Math.round(debt * 10) / 10, nights: nights.length };
}

function bedtimeToErase(debtHrs, wakeStr) {
  // Parse wake time (default 6:30 = 6.5)
  var wake = 6.5;
  if (wakeStr) {
    var wm = wakeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (wm) {
      var wh = parseInt(wm[1], 10);
      var wmin = parseInt(wm[2], 10);
      if (wm[3] && wm[3].toUpperCase() === 'PM' && wh < 12) wh += 12;
      if (wm[3] && wm[3].toUpperCase() === 'AM' && wh === 12) wh = 0;
      wake = wh + wmin / 60;
    }
  }

  var target = 8 + 0.8 * debtHrs;
  var capped = Math.min(target, 10.5); // max 8 + 2.5
  var bedH = wake - capped;
  if (bedH < 0) bedH += 24; // wrap past midnight

  // Format as 12h AM/PM
  var h = Math.floor(bedH);
  var m = Math.round((bedH - h) * 60);
  if (m === 60) { h++; m = 0; }
  var period = h >= 12 ? 'PM' : 'AM';
  var h12 = h % 12;
  if (h12 === 0) h12 = 12;
  var timeStr = h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + period;

  return { time: timeStr, sleptH: capped, capped: target > 10.5 };
}

function recoChart(dates) {
  if (!dates || dates.length === 0) {
    return '<div class="reco-chart-wrap"><p class="text-sm text-muted text-center">No recovery data this week</p></div>';
  }

  var vbW = 360, vbH = 200;
  var padL = 40, padR = 15, padT = 15, padB = 30;
  var chartW = vbW - padL - padR;
  var chartH = vbH - padT - padB;

  // Collect data points
  var points = [];
  dates.forEach(function(ds) {
    var rec = RECOVERY[ds];
    if (rec && rec.recovery != null) {
      points.push({ ds: ds, v: parseFloat(rec.recovery) });
    }
  });

  if (points.length === 0) {
    return '<div class="reco-chart-wrap"><p class="text-sm text-muted text-center">No recovery data this week</p></div>';
  }

  var svg = '<div class="reco-chart-wrap"><svg viewBox="0 0 ' + vbW + ' ' + vbH + '" xmlns="http://www.w3.org/2000/svg">';

  // Zone bands
  var zones = [
    { y0: 0, y1: 34, color: 'var(--color-warn)', opacity: 0.08 },
    { y0: 34, y1: 67, color: 'var(--color-info)', opacity: 0.08 },
    { y0: 67, y1: 100, color: 'var(--color-good)', opacity: 0.1 }
  ];

  zones.forEach(function(z) {
    var top = padT + chartH * (1 - z.y1 / 100);
    var h = chartH * (z.y1 - z.y0) / 100;
    svg += '<rect x="' + padL + '" y="' + top + '" width="' + chartW + '" height="' + h + '" ' +
      'fill="' + z.color + '" opacity="' + z.opacity + '"/>';
  });

  // Y-axis labels and gridlines
  [0, 33, 67, 100].forEach(function(val) {
    var y = padT + chartH * (1 - val / 100);
    svg += '<line x1="' + padL + '" y1="' + y + '" x2="' + (padL + chartW) + '" y2="' + y + '" ' +
      'stroke="var(--color-ink-faint)" stroke-width="0.5" stroke-dasharray="3,3"/>';
    svg += '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" text-anchor="end" ' +
      'font-size="9" fill="var(--color-ink-muted)" font-family="\'Space Grotesk\', monospace">' + val + '</text>';
  });

  // Y-axis title
  svg += '<text transform="rotate(-90)" x="' + -(padT + chartH / 2) + '" y="10" ' +
    'text-anchor="middle" font-size="8" fill="var(--color-ink-muted)" ' +
    'font-family="\'Hanken Grotesk\', sans-serif">Recovery %</text>';

  // X positions
  var xStep = points.length > 1 ? chartW / (points.length - 1) : 0;

  // X-axis date labels (first, mid, last)
  var xLabels = [];
  if (points.length >= 1) xLabels.push(0);
  if (points.length >= 3) xLabels.push(Math.floor(points.length / 2));
  if (points.length >= 2) xLabels.push(points.length - 1);

  xLabels.forEach(function(idx) {
    var x = padL + idx * xStep;
    svg += '<text x="' + x + '" y="' + (vbH - 5) + '" text-anchor="middle" ' +
      'font-size="9" fill="var(--color-ink-muted)" font-family="\'Space Grotesk\', monospace">' +
      fmt(points[idx].ds) + '</text>';
  });

  // Polyline
  var linePoints = points.map(function(pt, idx) {
    var x = padL + idx * xStep;
    var y = padT + chartH * (1 - pt.v / 100);
    return x + ',' + y;
  }).join(' ');

  svg += '<polyline points="' + linePoints + '" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';

  // Colored dots
  points.forEach(function(pt, idx) {
    var x = padL + idx * xStep;
    var y = padT + chartH * (1 - pt.v / 100);
    var dotColor = recColor(pt.v) === 'good' ? 'var(--color-good)'
      : recColor(pt.v) === 'info' ? 'var(--color-info)'
      : 'var(--color-warn)';
    svg += '<circle cx="' + x + '" cy="' + y + '" r="4" fill="' + dotColor + '" stroke="var(--color-card)" stroke-width="1.5"/>';
  });

  svg += '</svg></div>';
  return svg;
}

function openRecovery(ds) {
  var existing = RECOVERY[ds] || {};
  var recVal = existing.recovery != null ? existing.recovery : '';
  var hrvVal = existing.hrv != null ? existing.hrv : '';
  var rhrVal = existing.rhr != null ? existing.rhr : '';
  var sleepVal = existing.sleep || '';
  var srcVal = existing.src || 'manual';

  var html = '<div class="modal-title">Recovery · ' + fmt(ds, true) + '</div>';

  html += field('recRecovery', 'Recovery % (0–100)', recVal, 'number', '67');
  html += field('recHrv', 'HRV (ms)', hrvVal, 'number', '85');
  html += field('recRhr', 'Resting HR (bpm)', rhrVal, 'number', '48');
  html += field('recSleep', 'Sleep', sleepVal, 'text', '7:45');

  // Source toggle
  html += '<div class="form-group">' +
    '<label class="form-label">Source</label>' +
    '<div class="source-toggle" id="recSrcToggle">';
  ['manual', 'WHOOP', 'Garmin', 'Strava'].forEach(function(s) {
    html += '<button data-src="' + s + '"' + (s === srcVal ? ' class="active"' : '') + '>' + s + '</button>';
  });
  html += '</div></div>';

  html += '<div class="modal-actions">';
  if (existing.recovery != null) {
    html += '<button class="btn btn-danger" id="recDelete">Delete</button>';
  }
  html += '<button class="btn btn-ghost" id="recCancel">Cancel</button>' +
    '<button class="btn btn-primary" id="recSave">Save</button>' +
    '</div>';

  document.getElementById('modal').style.display = '';
  document.getElementById('modalContent').innerHTML = html;

  // Wire source toggle
  var srcBtns = document.querySelectorAll('#recSrcToggle button');
  var activeSrc = srcVal;
  srcBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      srcBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeSrc = btn.dataset.src;
    });
  });

  // Cancel
  document.getElementById('recCancel').addEventListener('click', function() {
    closeModal();
  });

  // Save
  document.getElementById('recSave').addEventListener('click', function() {
    var rv = parseFloat(document.getElementById('recRecovery').value);
    if (isNaN(rv)) {
      toast('Recovery % is required');
      return;
    }
    rv = Math.max(0, Math.min(100, Math.round(rv)));
    var entry = { recovery: rv, src: activeSrc };
    var hrvIn = document.getElementById('recHrv').value.trim();
    var rhrIn = document.getElementById('recRhr').value.trim();
    var sleepIn = document.getElementById('recSleep').value.trim();
    if (hrvIn !== '') entry.hrv = parseFloat(hrvIn) || 0;
    if (rhrIn !== '') entry.rhr = parseFloat(rhrIn) || 0;
    if (sleepIn !== '') entry.sleep = sleepIn;
    RECOVERY[ds] = entry;
    saveRec();
    closeModal();
    render();
    toast('Recovery saved');
  });

  // Delete
  var delBtn = document.getElementById('recDelete');
  if (delBtn) {
    delBtn.addEventListener('click', function() {
      delete RECOVERY[ds];
      saveRec();
      closeModal();
      render();
      toast('Recovery entry deleted');
    });
  }
}

function renderRecovery() {
  var el = document.getElementById('recoveryView');
  var selDay = recSelected || clampToday();
  var wk = weekOf(selDay);
  var wkDates = datesInWeek(wk);

  // Entries with recovery data for this week
  var wkEntries = wkDates.filter(function(d) {
    return RECOVERY[d] && RECOVERY[d].recovery != null;
  }).sort();

  // Resolve selected day: prefer explicit selection with data, else latest in-week, else latest overall, else null
  var selDs = null;
  if (recSelected && RECOVERY[recSelected] && RECOVERY[recSelected].recovery != null) {
    selDs = recSelected;
  } else if (wkEntries.length > 0) {
    selDs = wkEntries[wkEntries.length - 1];
  } else {
    // Latest overall entry
    var allRec = Object.keys(RECOVERY).filter(function(d) {
      return RECOVERY[d] && RECOVERY[d].recovery != null;
    }).sort();
    if (allRec.length > 0) selDs = allRec[allRec.length - 1];
  }

  var selRec = selDs ? RECOVERY[selDs] : null;
  var html = '';

  // Hero ring
  if (selRec) {
    var rv = parseFloat(selRec.recovery);
    var color = recColor(rv);
    var ringColor = color === 'good' ? 'var(--color-good)'
      : color === 'info' ? 'var(--color-info)'
      : 'var(--color-warn)';

    var r = 16, c = 2 * Math.PI * r;
    var p = Math.min(100, rv);
    var offset = c - (p / 100) * c;

    html += '<div class="card">' +
      '<div class="tracker-hero">' +
      '<div class="progress-ring progress-ring-xl">' +
      '<svg viewBox="0 0 40 40">' +
      '<circle class="progress-ring-bg" cx="20" cy="20" r="' + r + '"/>' +
      '<circle class="progress-ring-fill" cx="20" cy="20" r="' + r + '" ' +
      'stroke="' + ringColor + '" ' +
      'stroke-dasharray="' + c + '" ' +
      'stroke-dashoffset="' + offset + '"/>' +
      '</svg>' +
      '<span class="progress-ring-text">' + Math.round(rv) + '%</span>' +
      '</div>' +
      '<p class="text-sm text-muted mt-sm">' + fmt(selDs, true) + '</p>' +
      '<div class="flex gap-sm mt-sm" style="flex-wrap:wrap;justify-content:center">';

    if (selRec.hrv != null) html += '<span class="chip info">HRV ' + selRec.hrv + ' ms</span>';
    if (selRec.rhr != null) html += '<span class="chip info">RHR ' + selRec.rhr + '</span>';
    if (selRec.sleep) {
      var sleepH = parseSleepHrs(selRec.sleep);
      html += '<span class="chip info">Sleep ' + (sleepH != null ? fmtHrs(sleepH) : esc(selRec.sleep)) + '</span>';
    }
    if (selRec.src) html += '<span class="chip none">' + esc(selRec.src) + '</span>';

    html += '</div></div></div>';
  } else {
    html += '<div class="card">' +
      '<div class="tracker-hero">' +
      progressRing(0, 100, 'progress-ring-xl') +
      '<p class="text-sm text-muted mt-sm">No recovery data</p>' +
      '</div></div>';
  }

  // Sleep debt tile
  var sdDay = selDs || selDay;
  var sd = sleepDebt(sdDay);
  var w = BY_DATE[sdDay];
  var wakeStr = (w && w.guidance && w.guidance.sleep) ? w.guidance.sleep.wake : '6:30 AM';

  html += '<div class="card">' +
    '<h3>Sleep Debt</h3>';

  if (sd.nights === 0) {
    html += '<div class="sleep-debt-value mt-sm">—</div>' +
      '<p class="sleep-debt-sub">Log sleep to track debt</p>';
  } else if (sd.debt <= 0.1) {
    html += '<div class="sleep-debt-value mt-sm">' + sd.debt.toFixed(1) + 'h</div>' +
      '<p class="sleep-debt-sub">On track — keep your normal bedtime</p>';
  } else if (sd.debt < 0.5) {
    html += '<div class="sleep-debt-value mt-sm">' + sd.debt.toFixed(1) + 'h</div>' +
      '<p class="sleep-debt-sub">Basically caught up · ' + sd.nights + ' nights logged</p>';
  } else {
    html += '<div class="sleep-debt-value mt-sm">' + sd.debt.toFixed(1) + 'h</div>' +
      '<p class="sleep-debt-sub">vs 8h/night need · ' + sd.nights + ' nights logged</p>';

    var bed = bedtimeToErase(sd.debt, wakeStr);
    html += '<div class="mt-sm text-center">';
    if (bed.capped) {
      html += '<p class="text-sm">Tonight: aim for bed by <strong>' + bed.time + '</strong></p>' +
        '<p class="text-sm text-muted" style="font-size:11px">(' + bed.sleptH.toFixed(1) + 'h target — capped; clear the rest over the next few nights)</p>';
    } else {
      html += '<p class="text-sm">Tonight: aim for bed by <strong>' + bed.time + '</strong></p>' +
        '<p class="text-sm text-muted" style="font-size:11px">(' + bed.sleptH.toFixed(1) + 'h to clear ~80% of debt)</p>';
    }
    html += '</div>';
  }
  html += '</div>';

  // Chart
  html += '<div class="card">' +
    '<h3 class="mb-sm">This week\'s recovery</h3>' +
    recoChart(wkDates) +
    '</div>';

  // Log list (newest first)
  html += '<div class="card">' +
    '<h3 class="mb-sm">Recovery Log</h3>';

  if (wkEntries.length > 0) {
    var sorted = wkEntries.slice().reverse();
    sorted.forEach(function(ds) {
      var rec = RECOVERY[ds];
      var rv = parseFloat(rec.recovery);
      var isSel = (ds === selDs);
      html += '<div class="rec-row' + (isSel ? ' sel' : '') + '" data-recrow="' + ds + '">' +
        '<span class="rec-dot ' + recColor(rv) + '"></span>' +
        '<span class="text-sm" style="flex:1;font-weight:500">' + fmt(ds, true) + '</span>' +
        '<span class="text-sm" style="font-weight:600">' + Math.round(rv) + '%</span>';
      if (rec.hrv != null) html += '<span class="text-sm text-muted" style="font-size:11px;margin-left:6px">HRV ' + rec.hrv + '</span>';
      if (rec.rhr != null) html += '<span class="text-sm text-muted" style="font-size:11px;margin-left:6px">RHR ' + rec.rhr + '</span>';
      html += '</div>';
    });
  } else {
    html += '<p class="text-sm text-muted text-center">No recovery entries this week</p>';
  }

  html += '</div>';

  // Add/edit button
  html += '<button class="btn btn-primary btn-full mt-sm" id="recAddBtn">+ Add / edit recovery</button>';

  el.innerHTML = html;

  // Wire log row clicks → edit
  el.querySelectorAll('.rec-row[data-recrow]').forEach(function(row) {
    row.addEventListener('click', function() {
      openRecovery(row.dataset.recrow);
    });
  });

  // Wire add button
  var addBtn = document.getElementById('recAddBtn');
  if (addBtn) {
    addBtn.addEventListener('click', function() {
      openRecovery(selDs || selDay);
    });
  }
}
