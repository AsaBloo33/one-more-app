// ============================================
// chunk3-home.js — Home tab functions
// Spliced into the IIFE; all closured vars available.
// ============================================

// ---- Weight cascade (PRD 6.8) ----

function liftClass(name, reps) {
  var n = (name || '').toLowerCase();
  // Power moves (bodyweight / plyometric / isometric)
  if (/box\s*jump|pogo|a[- ]?skip|skip|bound|nordic|copenhagen|plank|pallof|skater/i.test(n)) {
    return 'power';
  }
  // Determine lower vs upper
  var lower = /squat|deadlift|lunge|hip\s*thrust|leg|calf|rdl|romanian|tibialis|nordic|copenhagen|bulgarian|bound|jump|pogo|skip/i.test(n);
  var repNum = parseRepNum(reps);
  if (repNum <= 6) {
    return lower ? 'strength_lower' : 'strength_upper';
  }
  return lower ? 'hyper_lower' : 'hyper_upper';
}

function weeklyBump(cls) {
  var map = {
    strength_lower: 7.5,
    strength_upper: 5,
    hyper_lower: 5,
    hyper_upper: 2.5,
    power: 0
  };
  return map[cls] != null ? map[cls] : 2.5;
}

function occurrencesOf(key) {
  var results = [];
  ALL_DATES.forEach(function(ds) {
    var w = BY_DATE[ds];
    if (!w || !w.lift || !w.lift.exercises) return;
    w.lift.exercises.forEach(function(e) {
      if (exKey(e.name) === key) {
        results.push({ ds: ds, e: e });
      }
    });
  });
  return results;
}

function getWeight(ds, name) {
  var k = ds + '|' + exKey(name);
  var v = WEIGHTS[k];
  return v != null ? v : '';
}

function setWeight(ds, ex, val) {
  var key = exKey(ex.name);
  var wKey = ds + '|' + key;
  var manKey = wKey + '|man';

  // 1. Clear or set
  if (val === '' || val == null) {
    delete WEIGHTS[wKey];
    delete WEIGHTS[manKey];
  } else {
    WEIGHTS[wKey] = parseFloat(val);
    WEIGHTS[manKey] = 1;
  }

  // 2. Cascade forward
  var cls = liftClass(ex.name, ex.reps);
  var bump = weeklyBump(cls);
  var occs = occurrencesOf(key);

  // Find this occurrence index
  var startIdx = -1;
  for (var i = 0; i < occs.length; i++) {
    if (occs[i].ds === ds) { startIdx = i; break; }
  }

  if (startIdx >= 0) {
    var prevDs = ds;
    var prevVal = (val === '' || val == null) ? null : parseFloat(val);

    for (var j = startIdx + 1; j < occs.length; j++) {
      var occ = occs[j];
      var oKey = occ.ds + '|' + key;
      var oManKey = oKey + '|man';

      // If this downstream occurrence has a manual flag, stop the cascade
      if (WEIGHTS[oManKey]) break;

      if (prevVal == null) {
        // Clearing: remove suggested value
        delete WEIGHTS[oKey];
      } else {
        // Compute suggestion
        var weekGap = Math.max(1, Math.round(daysBetween(prevDs, occ.ds) / 7));
        var suggested;
        if (cls === 'power') {
          suggested = prevVal;
        } else {
          suggested = prevVal + bump * weekGap;
        }
        suggested = Math.round(suggested * 10) / 10;
        WEIGHTS[oKey] = suggested;
        // Do NOT set man flag for suggestions (remove if it exists)
        delete WEIGHTS[oManKey];
      }

      prevDs = occ.ds;
      prevVal = WEIGHTS[occ.ds + '|' + key];
      if (prevVal == null) prevVal = null;
    }
  }

  saveWeights();
}

// ---- Tiles (PRD 6.3-6.6) ----

function tileShell(kind, title, sub, done, total, body, open) {
  var p = total ? Math.round(done / total * 100) : 0;
  var openCls = open ? ' open' : '';
  var chevron = '<svg class="tile-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>';

  var html = '<div class="tile' + openCls + '" data-tilekind="' + kind + '">';
  html += '<div class="tile-header" data-tilehead="' + kind + '">';
  if (total > 0) {
    html += progressRing(done, total, 'progress-ring-sm');
  }
  html += '<div class="tile-header-info">';
  html += '<div class="tile-title">' + title + '</div>';
  if (sub) html += '<div class="tile-sub">' + sub + '</div>';
  html += '</div>';
  html += chevron;
  html += '</div>';
  html += '<div class="tile-body">' + body + '</div>';
  html += '</div>';
  return html;
}

function splitRow(s, ds, i) {
  var checked = isChecked(ds, 'run', i);
  var cls = 'check-row' + (checked ? ' checked' : '');
  var label = '';
  if (s.reps && s.reps > 1) label += s.reps + 'x ';
  label += esc(s.distLabel || '');
  if (s.tag) label += ' <span class="text-xs text-muted">' + esc(s.tag) + '</span>';
  if (s.target) label += ' <span class="text-xs text-muted">@ ' + esc(s.target) + '</span>';

  return '<div class="' + cls + '" data-check="run|' + i + '">' +
    '<div class="check-circle"></div>' +
    '<span class="check-label">' + label + '</span>' +
    '</div>';
}

function tileRun(w) {
  if (!w.run) return '';
  var ds = w.date;
  var prog = sectionProgress(w, 'run');
  var done = prog[0], total = prog[1];
  var open = PREFS.open_run != null ? PREFS.open_run : true;

  var body = '<p class="text-sm text-muted mb-sm">' + esc(w.run.description || '') + '</p>';

  if (w.run.splits && w.run.splits.length > 0) {
    w.run.splits.forEach(function(s, i) {
      body += splitRow(s, ds, i);
    });
  } else {
    // Single check-row for the run
    var checked = isChecked(ds, 'run', 0);
    body += '<div class="check-row' + (checked ? ' checked' : '') + '" data-check="run|0">' +
      '<div class="check-circle"></div>' +
      '<span class="check-label">Mark run complete' + (w.miles ? ' (' + w.miles + ' mi)' : '') + '</span>' +
      '</div>';
  }

  // Run-log block
  var log = LOGS[ds] && LOGS[ds].run ? LOGS[ds].run : null;
  body += '<div class="divider"></div>';
  if (log) {
    body += '<div class="guidance-box mb-sm">';
    var parts = [];
    if (log.dist) parts.push('<span class="font-semibold">' + esc(log.dist) + '</span> mi');
    if (log.time) parts.push(esc(log.time));
    if (log.pace) parts.push(esc(log.pace) + '/mi');
    if (log.hr) parts.push(esc(String(log.hr)) + ' bpm');
    body += '<div class="font-medium">' + parts.join(' · ') + '</div>';
    if (log.note) body += '<div class="text-sm text-muted">' + esc(log.note) + '</div>';
    body += '<div class="flex gap-sm mt-xs" style="align-items:center;justify-content:space-between">';
    body += '<button class="btn btn-sm btn-secondary" data-runlog="' + ds + '">Edit run data</button>';
    body += '<span class="chip ' + (isDevice(log.src) ? 'on' : 'none') + '">' + esc(log.src || 'manual') + '</span>';
    body += '</div>';
    body += '</div>';
  } else {
    body += '<button class="btn btn-sm btn-ghost btn-full" data-runlog="' + ds + '">+ Log run data (manual)</button>';
  }

  var sub = w.runType || '';
  if (w.miles) sub += (sub ? ' · ' : '') + w.miles + ' mi';
  return tileShell('run', 'Run', sub, done, total, body, open);
}

function exRow(e, i, ds) {
  var checked = isChecked(ds, 'lift', i);
  var cls = liftClass(e.name, e.reps);
  var isPower = cls === 'power';
  var wt = getWeight(ds, e.name);
  var isManual = !!WEIGHTS[ds + '|' + exKey(e.name) + '|man'];

  var wtDisplay, wtClass;
  if (isPower) {
    wtDisplay = 'BW';
    wtClass = 'ex-weight-btn bw';
  } else if (wt !== '' && wt != null) {
    wtDisplay = wt + '';
    wtClass = 'ex-weight-btn' + (isManual ? '' : ' suggest');
  } else {
    wtDisplay = '—';
    wtClass = 'ex-weight-btn';
  }

  var html = '<div class="ex-row">';
  // Checkbox
  html += '<div class="check-row' + (checked ? ' checked' : '') + '" data-check="lift|' + i + '" style="padding:0;flex:0 0 auto">';
  html += '<div class="check-circle"></div>';
  html += '</div>';
  // Name (tappable to expand note)
  html += '<div class="ex-name" data-exnote="' + i + '">';
  html += '<div>' + esc(e.name) + '</div>';
  if (e.note) html += '<div class="ex-note">' + esc(e.note) + '</div>';
  html += '</div>';
  // Sets x reps
  html += '<span class="ex-sets">' + esc(e.sets || '') + 'x' + esc(e.reps || '') + '</span>';
  // Weight button
  html += '<button class="' + wtClass + '" data-weight="' + ds + '|' + i + '">' + esc(wtDisplay) + '</button>';
  html += '</div>';
  return html;
}

function tileLift(w) {
  if (!w.lift) {
    // On a run day (not race), show placeholder
    if (w.type === 'run' && !w.isRace) {
      return '<div class="card-flat text-sm text-muted p-md text-center">Mobility / core only today</div>';
    }
    return '';
  }

  var ds = w.date;
  var prog = sectionProgress(w, 'lift');
  var done = prog[0], total = prog[1];
  var open = PREFS.open_lift != null ? PREFS.open_lift : true;

  var body = '';
  if (w.lift.note) {
    body += '<div class="text-sm text-muted mb-sm" style="color:var(--color-warn)">' + esc(w.lift.note) + '</div>';
  }

  w.lift.exercises.forEach(function(e, i) {
    body += exRow(e, i, ds);
  });

  body += '<p class="text-xs text-faint mt-sm">Weights auto-cascade to future sessions. Tap a weight to edit.</p>';

  var sub = (w.lift.label || '') + (w.lift.muscle ? ' · ' + w.lift.muscle : '');
  return tileShell('lift', 'Lift', sub, done, total, body, open);
}

function tileCore(w) {
  if (!w.core) return '';
  var ds = w.date;
  var prog = sectionProgress(w, 'core');
  var done = prog[0], total = prog[1];
  var open = PREFS.open_core != null ? PREFS.open_core : false;
  var coreDone = isChecked(ds, 'core', 0);

  var body = '<div class="text-sm text-muted mb-sm">' +
    esc(w.core.subtitle || '') +
    (w.core.duration ? ' · ' + esc(w.core.duration) : '') +
    '</div>';

  // Core exercise grid
  body += '<div class="core-grid">';
  (w.core.exercises || []).forEach(function(ex) {
    body += '<div class="core-item' + (coreDone ? ' done' : '') + '">' + esc(ex) + '</div>';
  });
  body += '</div>';

  // Single check-row for the whole circuit
  body += '<div class="check-row' + (coreDone ? ' checked' : '') + '" data-check="core|0">' +
    '<div class="check-circle"></div>' +
    '<span class="check-label">Mark whole core circuit complete</span>' +
    '</div>';

  return tileShell('core', 'Core', w.core.label || '', done, total, body, open);
}

// ---- Completion (PRD 6.10) ----

function completeZone(w) {
  if (w.type === 'rest') return '';
  var ds = w.date;
  var log = LOGS[ds];

  if (log) {
    // Completed banner
    var html = '<div class="complete-zone">';
    html += '<div class="complete-banner">';
    html += '<div class="complete-check">&#10003;</div>';
    html += '<span class="font-semibold">Completed</span>';
    if (log.feel) html += '<span class="chip on">Felt ' + log.feel + '/10</span>';
    html += '</div>';
    var sub = log.note ? esc(log.note) : 'Logged ' + (log.at ? fmt(log.at.slice(0, 10)) : fmt(ds));
    html += '<div class="text-sm text-muted mb-sm">' + sub + '</div>';
    html += '<button class="btn btn-sm btn-danger" id="undoComplete">Undo</button>';
    html += '</div>';
    return html;
  }

  // Future
  if (ds > todayStr()) {
    return '<div class="complete-zone">' +
      '<p class="text-sm text-muted">Scheduled for ' + fmt(ds, true) + '</p>' +
      '</div>';
  }

  // Today or past - show mark complete
  return '<div class="complete-zone">' +
    '<button class="btn btn-accent btn-full" id="markComplete">&#10003; Mark Complete</button>' +
    '</div>';
}

function openComplete(ds) {
  var modal = document.getElementById('modal');
  var mc = document.getElementById('modalContent');
  modal.style.display = '';

  var html = '<div class="modal-title">How did it feel?</div>';
  html += '<p class="text-sm text-muted mb-sm">Optional — 1 (rough) to 10 (incredible)</p>';
  html += '<div class="feel-grid" id="feelGrid">';
  for (var i = 1; i <= 10; i++) {
    html += '<button class="feel-btn" data-feel="' + i + '">' + i + '</button>';
  }
  html += '</div>';
  html += '<div class="form-group">' +
    '<label class="form-label" for="completeNote">Note (optional)</label>' +
    '<textarea class="form-input" id="completeNote" placeholder="How was the workout?"></textarea>' +
    '</div>';
  html += '<div class="modal-actions">';
  html += '<button class="btn btn-ghost" id="skipComplete">Skip & Log</button>';
  html += '<button class="btn btn-primary" id="logComplete">Log</button>';
  html += '</div>';

  mc.innerHTML = html;

  var selectedFeel = null;
  document.querySelectorAll('#feelGrid .feel-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      selectedFeel = parseInt(btn.dataset.feel, 10);
      document.querySelectorAll('#feelGrid .feel-btn').forEach(function(b) {
        b.classList.toggle('active', b === btn);
      });
    });
  });

  document.getElementById('skipComplete').addEventListener('click', function() {
    var note = document.getElementById('completeNote').value.trim();
    doLog(ds, null, note);
  });

  document.getElementById('logComplete').addEventListener('click', function() {
    var note = document.getElementById('completeNote').value.trim();
    doLog(ds, selectedFeel, note);
  });
}

function doLog(ds, feel, note) {
  if (!LOGS[ds]) LOGS[ds] = {};
  LOGS[ds].feel = feel || null;
  LOGS[ds].note = note || '';
  if (!LOGS[ds].at) LOGS[ds].at = new Date().toISOString();
  saveLogs();
  closeModal();
  render();
  toast('Workout logged');
}

// ---- Modals (PRD 6.9, 6.11) ----

function openWeight(ds, ex) {
  var cls = liftClass(ex.name, ex.reps);
  if (cls === 'power') {
    toast('Bodyweight exercise — no weight to edit');
    return;
  }

  var modal = document.getElementById('modal');
  var mc = document.getElementById('modalContent');
  modal.style.display = '';

  var key = exKey(ex.name);
  var currentWt = getWeight(ds, ex.name);

  // Find last manually-logged weight among earlier occurrences
  var occs = occurrencesOf(key);
  var lastManual = null, lastManualDate = null;
  for (var i = 0; i < occs.length; i++) {
    if (occs[i].ds >= ds) break;
    var mKey = occs[i].ds + '|' + key + '|man';
    if (WEIGHTS[mKey]) {
      lastManual = WEIGHTS[occs[i].ds + '|' + key];
      lastManualDate = occs[i].ds;
    }
  }

  // Count future sessions that will be cascaded
  var futureCount = 0;
  for (var j = 0; j < occs.length; j++) {
    if (occs[j].ds > ds) futureCount++;
  }

  var bump = weeklyBump(cls);
  var baseVal = currentWt !== '' ? parseFloat(currentWt) : (lastManual != null ? lastManual : 0);

  var html = '<div class="modal-title">' + esc(ex.name) + '</div>';
  html += '<p class="text-sm text-muted mb-sm">' +
    esc((BY_DATE[ds] && BY_DATE[ds].lift ? BY_DATE[ds].lift.label : '') || '') +
    ' · ' + esc(ex.sets || '') + 'x' + esc(ex.reps || '') +
    ' · ' + fmt(ds) + '</p>';

  if (lastManual != null && lastManualDate) {
    html += '<p class="text-sm text-muted mb-sm">Last logged: ' + lastManual + ' lb on ' + fmt(lastManualDate) + '</p>';
  }

  html += '<div class="form-group">';
  html += '<label class="form-label">Weight (lb)</label>';
  html += '<div class="stepper">';
  html += '<button class="stepper-btn" id="wtMinus">-5</button>';
  html += '<input class="form-input" id="wtInput" type="text" inputmode="decimal" value="' + esc(String(currentWt)) + '" style="text-align:center;max-width:100px">';
  html += '<button class="stepper-btn" id="wtPlus">+5</button>';
  html += '</div>';
  html += '</div>';

  html += '<p class="text-xs text-faint mb-sm">+' + bump + ' lb/week auto-bump · ' + futureCount + ' future session' + (futureCount !== 1 ? 's' : '') + ' will update</p>';

  html += '<div class="modal-actions">';
  html += '<button class="btn btn-danger btn-sm" id="wtClear">Clear</button>';
  html += '<button class="btn btn-ghost" id="wtCancel">Cancel</button>';
  html += '<button class="btn btn-primary" id="wtSave">Save</button>';
  html += '</div>';

  mc.innerHTML = html;

  var input = document.getElementById('wtInput');

  document.getElementById('wtCancel').addEventListener('click', closeModal);
  document.getElementById('wtMinus').addEventListener('click', function() {
    var cur = parseFloat(input.value) || baseVal;
    input.value = Math.max(0, Math.round((cur - 5) * 10) / 10);
  });
  document.getElementById('wtPlus').addEventListener('click', function() {
    var cur = parseFloat(input.value) || baseVal;
    input.value = Math.round((cur + 5) * 10) / 10;
  });

  document.getElementById('wtClear').addEventListener('click', function() {
    setWeight(ds, ex, '');
    closeModal();
    render();
    toast('Weight cleared');
  });

  document.getElementById('wtSave').addEventListener('click', function() {
    var v = parseFloat(input.value);
    if (isNaN(v) || v < 0) {
      toast('Enter a valid weight');
      return;
    }
    setWeight(ds, ex, v);
    closeModal();
    render();
    toast('Weight saved — ' + v + ' lb');
  });
}

function openRunLog(ds) {
  var modal = document.getElementById('modal');
  var mc = document.getElementById('modalContent');
  modal.style.display = '';

  var existing = (LOGS[ds] && LOGS[ds].run) ? LOGS[ds].run : {};

  var html = '<div class="modal-title">Run Data</div>';
  html += '<p class="text-sm text-muted mb-sm">' + fmt(ds, true) + '</p>';

  html += '<div class="form-row">';
  html += field('rlDist', 'Distance (mi)', existing.dist || '', 'number', 'e.g. 5.5');
  html += field('rlTime', 'Time', existing.time || '', 'text', 'mm:ss or h:mm:ss');
  html += '</div>';

  html += '<div class="form-row">';
  html += field('rlPace', 'Avg pace (/mi)', existing.pace || '', 'text', 'e.g. 7:30');
  html += field('rlHr', 'Avg HR', existing.hr || '', 'number', 'bpm');
  html += '</div>';

  html += '<div class="form-group">' +
    '<label class="form-label" for="rlNote">Note</label>' +
    '<textarea class="form-input" id="rlNote" placeholder="Optional">' + esc(existing.note || '') + '</textarea>' +
    '</div>';

  // Source toggle
  var src = existing.src || 'manual';
  var srcs = ['manual', 'Strava', 'Garmin', 'WHOOP'];
  html += '<div class="form-group">';
  html += '<label class="form-label">Source</label>';
  html += '<div class="source-toggle" id="rlSrcToggle">';
  srcs.forEach(function(s) {
    html += '<button data-src="' + s + '"' + (s === src ? ' class="active"' : '') + '>' + s + '</button>';
  });
  html += '</div></div>';

  html += '<div class="modal-actions">';
  html += '<button class="btn btn-ghost" id="rlCancel">Cancel</button>';
  html += '<button class="btn btn-primary" id="rlSave">Save</button>';
  html += '</div>';

  mc.innerHTML = html;

  document.getElementById('rlCancel').addEventListener('click', closeModal);

  // Source toggle wiring
  document.querySelectorAll('#rlSrcToggle button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#rlSrcToggle button').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

  document.getElementById('rlSave').addEventListener('click', function() {
    var dist = document.getElementById('rlDist').value.trim();
    var time = document.getElementById('rlTime').value.trim();
    var pace = document.getElementById('rlPace').value.trim();
    var hr = document.getElementById('rlHr').value.trim();
    var note = document.getElementById('rlNote').value.trim();
    var activeSrc = document.querySelector('#rlSrcToggle button.active');
    var srcVal = activeSrc ? activeSrc.dataset.src : 'manual';

    // Pace auto-calc
    if (!pace && dist && time) {
      var distNum = parseFloat(dist);
      var timeSec = parseTime(time);
      if (distNum > 0 && timeSec > 0) {
        pace = secToPace(timeSec / distNum);
      }
    }

    if (!LOGS[ds]) LOGS[ds] = {};
    LOGS[ds].run = {
      dist: dist || '',
      time: time || '',
      pace: pace || '',
      hr: hr || '',
      note: note || '',
      src: srcVal
    };
    if (!LOGS[ds].at) LOGS[ds].at = new Date().toISOString();
    saveLogs();
    closeModal();
    render();
    toast('Run data saved');
  });
}

// ---- Food (PRD 6.12-6.13) ----

function macroRing(label, got, tgt, cls) {
  var p = tgt > 0 ? Math.min(100, Math.round(got / tgt * 100)) : 0;
  var r = 16, c = 2 * Math.PI * r;
  var offset = c - (p / 100) * c;
  var color = p >= 100 ? 'var(--color-good)' : p >= 50 ? 'var(--color-primary)' : 'var(--color-ink-faint)';

  return '<div class="macro-ring-wrap">' +
    '<div class="macro-ring-label">' + esc(label) + '</div>' +
    '<div class="progress-ring progress-ring-sm">' +
    '<svg viewBox="0 0 40 40">' +
    '<circle class="progress-ring-bg" cx="20" cy="20" r="' + r + '"/>' +
    '<circle class="progress-ring-fill" cx="20" cy="20" r="' + r + '" ' +
    'stroke="' + color + '" ' +
    'stroke-dasharray="' + c + '" ' +
    'stroke-dashoffset="' + offset + '"/>' +
    '</svg>' +
    '<span class="progress-ring-text" style="font-size:8px">' + p + '%</span>' +
    '</div>' +
    '<div class="macro-ring-value">' + Math.round(got) + '/' + tgt + 'g</div>' +
    '</div>';
}

function foodPanel(w) {
  if (w.type === 'rest') return '';
  var ds = w.date;
  var open = PREFS.open_food != null ? PREFS.open_food : false;
  var tgt = macroTargets(ds);
  var got = foodTotals(ds);

  var kcalP = tgt.kcal > 0 ? Math.min(100, Math.round(got.kcal / tgt.kcal * 100)) : 0;
  var kcalStatus = barStatus(kcalP);

  var body = '';

  // Kcal bar
  body += '<div class="kcal-bar-wrap">';
  body += '<div class="kcal-header">';
  body += '<span class="kcal-got">' + Math.round(got.kcal) + '</span>';
  body += '<span class="kcal-target">/ ' + tgt.kcal + ' kcal</span>';
  body += '</div>';
  body += '<div class="fill-bar"><div class="fill-bar-inner ' + kcalStatus + '" style="width:' + kcalP + '%"></div></div>';
  body += '</div>';

  // Macro rings
  body += '<div class="macro-rings">';
  body += macroRing('Protein', got.p, tgt.p, 'protein');
  body += macroRing('Carbs', got.c, tgt.c, 'carbs');
  body += macroRing('Fat', got.f, tgt.f, 'fat');
  body += '</div>';

  // Protein timing guidance
  var pTgt = tgt.p || 176;
  var per = Math.round(pTgt / 4 / 5) * 5;
  var preSnack = Math.round(per * 0.6 / 5) * 5;

  body += '<div class="guidance-section">';
  body += '<div class="guidance-section-title">Protein Timing</div>';
  var feedings = [
    { label: 'Post-run breakfast', grams: per, foods: 'Oats + whey + fruit' },
    { label: 'Lunch', grams: per, foods: 'Chicken + rice + veg' },
    { label: 'Pre-lift snack', grams: preSnack, foods: 'Greek yogurt + granola' },
    { label: 'Dinner + bedtime', grams: per, foods: 'Lean meat + potato + casein shake (+30g casein)' }
  ];
  feedings.forEach(function(f) {
    body += '<div class="guidance-box mb-xs">';
    body += '<div class="flex flex-between"><span class="font-medium text-sm">' + esc(f.label) + '</span><span class="text-sm font-semibold">~' + f.grams + 'g</span></div>';
    body += '<div class="text-xs text-muted">' + esc(f.foods) + '</div>';
    body += '</div>';
  });
  body += '</div>';

  // Food entries
  body += '<div class="guidance-section">';
  body += '<div class="guidance-section-title">Logged Food</div>';
  var fd = FOOD[ds];
  if (fd && fd.entries && fd.entries.length > 0) {
    fd.entries.forEach(function(entry, idx) {
      body += '<div class="food-entry">';
      body += '<span class="food-entry-name">' + esc(entry.name || 'Food') + '</span>';
      body += '<span class="food-entry-macros">' + Math.round(entry.kcal || 0) + 'cal · ' +
        Math.round(entry.p || 0) + 'P · ' + Math.round(entry.c || 0) + 'C · ' + Math.round(entry.f || 0) + 'F</span>';
      body += '<button class="food-entry-del" data-fooddel="' + idx + '">&times;</button>';
      body += '</div>';
    });
  } else {
    body += '<p class="text-sm text-muted">No food logged yet today.</p>';
  }
  body += '</div>';

  // Add food button
  body += '<button class="btn btn-sm btn-secondary btn-full mt-sm" data-foodadd="' + ds + '">+ Log food (search FatSecret / manual)</button>';

  var sub = Math.round(got.kcal) + ' / ' + tgt.kcal + ' kcal';
  return tileShell('food', 'Nutrition', sub, Math.round(got.kcal), tgt.kcal, body, open);
}

function openFood(ds) {
  var modal = document.getElementById('modal');
  var mc = document.getElementById('modalContent');
  modal.style.display = '';

  var html = '<div class="modal-title">Log Food</div>';
  html += '<p class="text-sm text-muted mb-sm">' + fmt(ds, true) + '</p>';

  // Search
  html += '<div class="form-group">';
  html += '<label class="form-label">Search (FatSecret)</label>';
  html += '<div class="flex gap-sm">';
  html += '<input class="form-input" id="foodQuery" type="text" placeholder="e.g. chicken breast">';
  html += '<button class="btn btn-sm btn-primary" id="foodSearch">Search</button>';
  html += '</div></div>';
  html += '<div id="foodResults" class="mb-sm"></div>';

  // Manual fields
  html += '<div class="divider"></div>';
  html += field('foodName', 'Food name', '', 'text', 'e.g. Grilled chicken');
  html += '<div class="form-row">';
  html += field('foodKcal', 'Calories', '', 'number', 'kcal');
  html += field('foodP', 'Protein (g)', '', 'number', 'g');
  html += '</div>';
  html += '<div class="form-row">';
  html += field('foodC', 'Carbs (g)', '', 'number', 'g');
  html += field('foodF', 'Fat (g)', '', 'number', 'g');
  html += '</div>';

  html += '<div class="modal-actions">';
  html += '<button class="btn btn-ghost" id="foodCancel">Cancel</button>';
  html += '<button class="btn btn-primary" id="foodSave">Save</button>';
  html += '</div>';

  mc.innerHTML = html;

  function doSearch() {
    var query = document.getElementById('foodQuery').value.trim();
    var resultsEl = document.getElementById('foodResults');
    if (!query) { resultsEl.innerHTML = ''; return; }

    if (!BACKEND_URL) {
      resultsEl.innerHTML = '<p class="text-sm text-muted">Connect backend (Alt/long-press Recovery tab) to enable food search. Enter manually below.</p>';
      return;
    }

    var url = BACKEND_URL + '/food-search?q=' + encodeURIComponent(query);
    if (DATA_TOKEN) url += '&token=' + encodeURIComponent(DATA_TOKEN);

    resultsEl.innerHTML = '<p class="text-sm text-muted">Searching...</p>';

    fetch(url, { cache: 'no-store' })
      .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(data) {
        var items = data.foods || data.results || [];
        if (items.length === 0) {
          resultsEl.innerHTML = '<p class="text-sm text-muted">No results. Try a different search or enter manually.</p>';
          return;
        }
        var rHtml = '';
        items.slice(0, 8).forEach(function(item) {
          rHtml += '<div class="food-entry" style="cursor:pointer" data-foodresult>' +
            '<span class="food-entry-name">' + esc(item.name || '') + '</span>' +
            '<span class="food-entry-macros">' +
            Math.round(item.kcal || item.calories || 0) + 'cal · ' +
            Math.round(item.p || item.protein || 0) + 'P · ' +
            Math.round(item.c || item.carbs || 0) + 'C · ' +
            Math.round(item.f || item.fat || 0) + 'F</span>' +
            '</div>';
          // Store data as data attributes on the element
          rHtml = rHtml.replace('data-foodresult',
            'data-fname="' + esc(item.name || '') + '" ' +
            'data-fkcal="' + (item.kcal || item.calories || 0) + '" ' +
            'data-fp="' + (item.p || item.protein || 0) + '" ' +
            'data-fc="' + (item.c || item.carbs || 0) + '" ' +
            'data-ff="' + (item.f || item.fat || 0) + '"');
        });
        resultsEl.innerHTML = rHtml;

        // Wire result taps to populate fields
        resultsEl.querySelectorAll('.food-entry').forEach(function(el) {
          el.addEventListener('click', function() {
            document.getElementById('foodName').value = el.dataset.fname || '';
            document.getElementById('foodKcal').value = el.dataset.fkcal || '';
            document.getElementById('foodP').value = el.dataset.fp || '';
            document.getElementById('foodC').value = el.dataset.fc || '';
            document.getElementById('foodF').value = el.dataset.ff || '';
          });
        });
      })
      .catch(function() {
        resultsEl.innerHTML = '<p class="text-sm text-muted">Search unavailable. Enter manually below.</p>';
      });
  }

  document.getElementById('foodCancel').addEventListener('click', closeModal);
  document.getElementById('foodSearch').addEventListener('click', doSearch);
  document.getElementById('foodQuery').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doSearch();
  });

  document.getElementById('foodSave').addEventListener('click', function() {
    var name = document.getElementById('foodName').value.trim();
    var kcal = parseFloat(document.getElementById('foodKcal').value) || 0;
    var p = parseFloat(document.getElementById('foodP').value) || 0;
    var c = parseFloat(document.getElementById('foodC').value) || 0;
    var f = parseFloat(document.getElementById('foodF').value) || 0;

    if (!kcal && !p && !c && !f) {
      toast('Enter at least one macro or calorie value');
      return;
    }

    // Auto-calc kcal if blank
    if (!kcal && (p || c || f)) {
      kcal = p * 4 + c * 4 + f * 9;
    }

    if (!FOOD[ds]) FOOD[ds] = { entries: [] };
    if (!FOOD[ds].entries) FOOD[ds].entries = [];
    FOOD[ds].entries.push({
      name: name || 'Food',
      kcal: Math.round(kcal),
      p: Math.round(p),
      c: Math.round(c),
      f: Math.round(f),
      src: 'manual'
    });
    saveFood();
    closeModal();
    render();
    toast('Food logged');
  });
}

// ---- Recovery panel (PRD 6.14) ----

function fullStackBlock() {
  var html = '<div class="guidance-section">';
  html += '<div class="guidance-section-title" style="cursor:pointer" id="stackToggle">Full Supplement Stack Reference &#9660;</div>';
  html += '<div id="stackBody" style="display:none">';

  function renderGroup(title, items) {
    var h = '<h4 class="text-sm font-semibold mt-sm mb-xs">' + esc(title) + '</h4>';
    items.forEach(function(s) {
      h += '<div class="supp-row">';
      h += '<span class="supp-name">' + esc(s.name) + '</span>';
      h += '<span class="supp-dose">' + esc(s.dose) + '</span>';
      h += '<span class="text-xs text-muted" style="flex:1">' + esc(s.note) + '</span>';
      h += '</div>';
    });
    return h;
  }

  html += renderGroup('Daily', FULL_STACK.daily);
  html += renderGroup('Optional', FULL_STACK.optional);
  html += renderGroup('Key / Long / Race Days', FULL_STACK.keyDays);

  html += '<p class="text-xs text-faint mt-sm">Source from reputable brands (Thorne, NOW, Klean Athlete). Get blood work every 3-6 months to verify levels.</p>';
  html += '</div></div>';
  return html;
}

function recoveryPanel(w) {
  if (!w || !w.guidance) return '';
  var g = w.guidance;
  var open = PREFS.panelOpen != null ? PREFS.panelOpen : false;

  var catMap = {
    hard_lift: 'Hard Lift',
    hard_run: 'Hard Run',
    easy: 'Easy / Recovery',
    rest: 'Rest'
  };
  var catLabel = catMap[g.category] || g.category || 'Training';

  var body = '';

  // Category badge
  body += '<div class="chip near mb-sm">' + esc(catLabel) + '</div>';

  // Sleep & Schedule
  if (g.sleep) {
    body += '<div class="guidance-section">';
    body += '<div class="guidance-section-title">Sleep & Schedule</div>';
    body += '<div class="guidance-box">';
    if (g.sleep.bed) body += '<div class="guidance-row"><span class="label">Lights out</span><span class="value">' + esc(g.sleep.bed) + '</span></div>';
    if (g.sleep.wake) body += '<div class="guidance-row"><span class="label">Wake</span><span class="value">' + esc(g.sleep.wake) + '</span></div>';
    if (g.sleep.runStart) body += '<div class="guidance-row"><span class="label">Run start</span><span class="value">' + esc(g.sleep.runStart) + '</span></div>';
    if (g.sleep.duration) body += '<div class="guidance-row"><span class="label">Duration</span><span class="value">' + esc(g.sleep.duration) + '</span></div>';
    body += '</div>';
    if (g.sleep.note) body += '<p class="text-xs text-muted mt-xs">' + esc(g.sleep.note) + '</p>';
    body += '</div>';
  }

  // Daily Targets
  if (g.macros) {
    body += '<div class="guidance-section">';
    body += '<div class="guidance-section-title">Daily Targets</div>';
    body += '<div class="guidance-box">';
    if (g.macros.calories) body += '<div class="guidance-row"><span class="label">Calories</span><span class="value">' + g.macros.calories + ' kcal</span></div>';
    if (g.macros.protein) body += '<div class="guidance-row"><span class="label">Protein</span><span class="value">' + esc(g.macros.protein) + '</span></div>';
    if (g.macros.carbs) body += '<div class="guidance-row"><span class="label">Carbs</span><span class="value">' + esc(g.macros.carbs) + '</span></div>';
    if (g.macros.fat) body += '<div class="guidance-row"><span class="label">Fat</span><span class="value">' + esc(g.macros.fat) + '</span></div>';
    body += '</div>';
    if (g.macros.carbNote) body += '<p class="text-xs text-muted mt-xs">' + esc(g.macros.carbNote) + '</p>';
    // Portioning tip
    var pTarget = parseInt(g.macros.protein, 10) || 176;
    var portionPer = Math.round(pTarget / 4 / 5) * 5;
    body += '<p class="text-xs text-faint mt-xs">Aim for ~' + portionPer + 'g protein per meal across 4 feedings.</p>';
    body += '</div>';
  }

  // Meal Timing
  if (g.meals && g.meals.length) {
    body += '<div class="guidance-section">';
    body += '<div class="guidance-section-title">Meal Timing</div>';
    g.meals.forEach(function(meal) {
      body += '<div class="guidance-box mb-xs">';
      body += '<div class="font-medium text-sm">' + esc(meal.phase) + '</div>';
      body += '<div class="text-xs text-muted">' + esc(meal.text) + '</div>';
      body += '</div>';
    });
    body += '</div>';
  }

  // Supplements
  if (g.supplements && g.supplements.length) {
    body += '<div class="guidance-section">';
    body += '<div class="guidance-section-title">Supplements</div>';
    g.supplements.forEach(function(s) {
      body += '<div class="supp-row">';
      body += '<span class="supp-name">' + esc(s.name) + '</span>';
      body += '<span class="supp-dose">' + esc(s.dose) + '</span>';
      body += '<span class="text-xs text-muted" style="flex:1">' + esc(s.timing) + '</span>';
      body += '</div>';
      if (s.note) body += '<p class="text-xs text-faint" style="padding-left:108px;margin-top:-2px">' + esc(s.note) + '</p>';
    });
    body += '</div>';
  }

  // Full stack reference
  body += fullStackBlock();

  // Hydration
  if (g.hydration) {
    body += '<div class="guidance-section">';
    body += '<div class="guidance-section-title">Hydration</div>';
    body += '<p class="text-sm">' + esc(g.hydration) + '</p>';
    body += '</div>';
  }

  // Disclaimer
  body += '<p class="text-xs text-faint mt-sm">This guidance is informational, not medical advice. Consult a healthcare provider before starting any supplement regimen.</p>';

  var openCls = open ? ' open' : '';
  var chevron = '<svg class="tile-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>';

  var html = '<div class="tile' + openCls + '" data-tilekind="recovery">';
  html += '<div class="tile-header" id="panelToggle">';
  html += '<div class="tile-header-info">';
  html += '<div class="tile-title">Recovery & Fuel</div>';
  html += '<div class="tile-sub">' + esc(catLabel) + ' day guidance</div>';
  html += '</div>';
  html += chevron;
  html += '</div>';
  html += '<div class="tile-body">' + body + '</div>';
  html += '</div>';

  return html;
}

// ---- Event wiring (PRD 6.15) ----

function wireToday(w) {
  var ds = w ? w.date : SELECTED;

  // Tile header toggles
  document.querySelectorAll('[data-tilehead]').forEach(function(header) {
    header.addEventListener('click', function() {
      var kind = header.dataset.tilehead;
      var tile = header.closest('.tile');
      if (tile) {
        tile.classList.toggle('open');
        var isOpen = tile.classList.contains('open');
        PREFS['open_' + kind] = isOpen;
        savePrefs();
      }
    });
  });

  // Exercise name expansion (toggle note)
  document.querySelectorAll('[data-exnote]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      // Don't toggle if they clicked the checkbox
      if (e.target.closest('.check-row')) return;
      el.classList.toggle('expanded');
    });
  });

  // Check-rows
  document.querySelectorAll('[data-check]').forEach(function(row) {
    row.addEventListener('click', function() {
      var parts = row.dataset.check.split('|');
      var kind = parts[0];
      var idx = parseInt(parts[1], 10);
      toggleCheck(ds, kind, idx);
      render();
    });
  });

  // Weight buttons
  document.querySelectorAll('[data-weight]').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var parts = btn.dataset.weight.split('|');
      var wDs = parts[0];
      var exIdx = parseInt(parts[1], 10);
      var wk = BY_DATE[wDs];
      if (!wk || !wk.lift || !wk.lift.exercises[exIdx]) return;
      var ex = wk.lift.exercises[exIdx];
      openWeight(wDs, ex);
    });
  });

  // Run-log buttons
  document.querySelectorAll('[data-runlog]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      openRunLog(btn.dataset.runlog);
    });
  });

  // Food add button
  document.querySelectorAll('[data-foodadd]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      openFood(btn.dataset.foodadd);
    });
  });

  // Food delete buttons
  document.querySelectorAll('[data-fooddel]').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var idx = parseInt(btn.dataset.fooddel, 10);
      if (FOOD[ds] && FOOD[ds].entries) {
        FOOD[ds].entries.splice(idx, 1);
        if (FOOD[ds].entries.length === 0) delete FOOD[ds];
        saveFood();
        render();
      }
    });
  });

  // Recovery panel toggle
  var panelToggle = document.getElementById('panelToggle');
  if (panelToggle) {
    panelToggle.addEventListener('click', function() {
      var tile = panelToggle.closest('.tile');
      if (tile) {
        tile.classList.toggle('open');
        PREFS.panelOpen = tile.classList.contains('open');
        savePrefs();
      }
    });
  }

  // Full stack toggle
  var stackToggle = document.getElementById('stackToggle');
  if (stackToggle) {
    stackToggle.addEventListener('click', function() {
      var body = document.getElementById('stackBody');
      if (body) {
        var show = body.style.display === 'none';
        body.style.display = show ? '' : 'none';
        stackToggle.innerHTML = 'Full Supplement Stack Reference ' + (show ? '&#9650;' : '&#9660;');
      }
    });
  }

  // Complete button
  var markBtn = document.getElementById('markComplete');
  if (markBtn) {
    markBtn.addEventListener('click', function() {
      openComplete(ds);
    });
  }

  // Undo button
  var undoBtn = document.getElementById('undoComplete');
  if (undoBtn) {
    undoBtn.addEventListener('click', function() {
      delete LOGS[SELECTED];
      saveLogs();
      render();
      toast('Completion undone');
    });
  }
}

// ---- Main render (PRD 6.1-6.2) ----

function renderToday() {
  var w = BY_DATE[SELECTED];
  var el = document.getElementById('todayView');

  if (!w) {
    el.innerHTML = '<div class="card"><div class="placeholder">' +
      '<div class="placeholder-icon">+1</div>' +
      '<h3>No workout data</h3>' +
      '<p class="text-sm text-muted">Select a training day from the week strip above.</p>' +
      '</div></div>';
    return;
  }

  var html = '';

  // Focus bar
  html += '<div class="focus-bar">' + esc(w.phase || '') + ' · ' + esc(w.focus || '') + '</div>';

  if (w.type === 'rest') {
    // Rest day: focus bar + rest card + recovery panel only
    html += '<div class="card">';
    html += '<div class="flex gap-sm mb-sm" style="align-items:center">';
    html += '<span class="day-tag rest">Rest</span>';
    html += '<span class="text-sm text-muted">' + fmt(SELECTED, true) + '</span>';
    html += '</div>';
    html += '<h2>' + esc(w.title || 'Rest Day') + '</h2>';
    if (w.run && w.run.description) {
      html += '<p class="text-sm text-muted mt-sm">' + esc(w.run.description) + '</p>';
    } else {
      html += '<p class="text-sm text-muted mt-sm">Full rest. Let your body recover and rebuild.</p>';
    }
    html += '</div>';
    html += recoveryPanel(w);
    el.innerHTML = html;
    wireToday(w);
    return;
  }

  // Training day
  var tag = markType(w);
  var tagLabel = tag === 'race' ? '&#127937; Race' : (w.lift ? 'Run + Lift' : 'Run');
  var tagClass = tag === 'race' ? 'race' : '';

  // Day header
  html += '<div style="margin-bottom:12px">';
  html += '<div class="flex gap-sm mb-xs" style="align-items:center">';
  html += '<span class="day-tag ' + tagClass + '">' + tagLabel + '</span>';
  html += '<span class="text-sm text-muted">' + fmt(SELECTED, true) + '</span>';
  html += '</div>';
  html += '<h2>' + esc(w.title || 'Today') + (w.miles ? ' · ' + w.miles + ' mi' : '') + '</h2>';
  html += '</div>';

  // Tiles
  html += tileRun(w);
  html += tileLift(w);
  html += tileCore(w);

  // Complete zone
  html += completeZone(w);

  // Food panel
  html += foodPanel(w);

  // Recovery panel
  html += recoveryPanel(w);

  el.innerHTML = html;
  wireToday(w);
}
