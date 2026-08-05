(() => {
  "use strict";

  /* ---------------- STORAGE ---------------- */
  const CONFIG_KEY = "ponto_config_v1";
  const RECORDS_KEY = "ponto_records_v1";
  const WEEKDAY_NAMES = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

  function loadConfig(){
    try{
      const raw = localStorage.getItem(CONFIG_KEY);
      if(!raw) return { salary: 0, hoursPerDay: 0, workDays: [1,2,3,4,5] };
      return JSON.parse(raw);
    }catch(e){
      return { salary: 0, hoursPerDay: 0, workDays: [1,2,3,4,5] };
    }
  }
  function saveConfig(cfg){
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  }
  function loadRecords(){
    try{
      const raw = localStorage.getItem(RECORDS_KEY);
      if(!raw) return [];
      return JSON.parse(raw);
    }catch(e){
      return [];
    }
  }
  function saveRecords(records){
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  }

  let config = loadConfig();
  let records = loadRecords();

  /* ---------------- HELPERS ---------------- */
  function pad(n){ return String(n).padStart(2,"0"); }

  function todayISO(){
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function monthKeyOf(iso){ return iso.slice(0,7); } // YYYY-MM
  function currentMonthKey(){ return monthKeyOf(todayISO()); }

  function formatHMS(totalSeconds){
    const h = Math.floor(totalSeconds/3600);
    const m = Math.floor((totalSeconds%3600)/60);
    const s = Math.floor(totalSeconds%60);
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  function formatHoursMinutes(totalSeconds){
    const h = Math.floor(totalSeconds/3600);
    const m = Math.round((totalSeconds%3600)/60);
    return `${h}h ${pad(m)}m`;
  }
  function formatMoney(v){
    if(!isFinite(v)) v = 0;
    return v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  }

  // conta quantos dias de determinado weekday-set existem num mês (0-11)
  function countWorkDaysInMonth(year, monthIndex, workDaysSet){
    let count = 0;
    const daysInMonth = new Date(year, monthIndex+1, 0).getDate();
    for(let d=1; d<=daysInMonth; d++){
      const wd = new Date(year, monthIndex, d).getDay();
      if(workDaysSet.has(wd)) count++;
    }
    return count;
  }

  /* ---------------- TABS ---------------- */
  const tabBtns = document.querySelectorAll(".tab-btn");
  const screens = document.querySelectorAll(".screen");
  tabBtns.forEach(btn=>{
    btn.addEventListener("click", () => {
      tabBtns.forEach(b=>b.classList.remove("active"));
      screens.forEach(s=>s.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`screen-${btn.dataset.tab}`).classList.add("active");
      if(btn.dataset.tab === "historico") renderHistory();
      if(btn.dataset.tab === "config") renderConfigForm();
    });
  });

  /* ---------------- CONFIG SCREEN ---------------- */
  const inputSalary = document.getElementById("input-salary");
  const inputHoursDay = document.getElementById("input-hours-day");
  const weekdayGrid = document.getElementById("weekday-grid");
  const weekdayBtns = weekdayGrid.querySelectorAll(".weekday-btn");
  const btnSaveConfig = document.getElementById("btn-save-config");
  const saveConfirm = document.getElementById("save-confirm");

  function renderConfigForm(){
    inputSalary.value = config.salary || "";
    inputHoursDay.value = config.hoursPerDay || "";
    weekdayBtns.forEach(b=>{
      const day = Number(b.dataset.day);
      b.classList.toggle("selected", config.workDays.includes(day));
    });
  }

  weekdayBtns.forEach(b=>{
    b.addEventListener("click", () => {
      b.classList.toggle("selected");
    });
  });

  btnSaveConfig.addEventListener("click", () => {
    const selectedDays = [...weekdayBtns]
      .filter(b=>b.classList.contains("selected"))
      .map(b=>Number(b.dataset.day));

    config = {
      salary: parseFloat(inputSalary.value) || 0,
      hoursPerDay: parseFloat(inputHoursDay.value) || 0,
      workDays: selectedDays
    };
    saveConfig(config);
    saveConfirm.classList.remove("hidden");
    setTimeout(()=>saveConfirm.classList.add("hidden"), 2000);
    updateEarningsPanel();
  });

  /* ---------------- CRONÔMETRO ---------------- */
  const clockDisplay = document.getElementById("clock-display");
  const clockStatus = document.getElementById("clock-status");
  const btnToggle = document.getElementById("btn-toggle");
  const btnToggleLabel = document.getElementById("btn-toggle-label");

  const TIMER_STATE_KEY = "ponto_timer_running_v1";

  let timerInterval = null;
  let startTimestamp = null; // ms

  function restoreRunningTimer(){
    const raw = localStorage.getItem(TIMER_STATE_KEY);
    if(!raw) return;
    try{
      const state = JSON.parse(raw);
      if(state && state.startTimestamp){
        startTimestamp = state.startTimestamp;
        beginTicking();
      }
    }catch(e){}
  }

  function beginTicking(){
    clockDisplay.classList.add("running");
    clockStatus.classList.add("running");
    clockStatus.textContent = "Trabalhando...";
    btnToggle.classList.add("running");
    btnToggleLabel.textContent = "Finalizar";

    tick();
    timerInterval = setInterval(tick, 1000);
  }

  function tick(){
    const elapsed = Math.floor((Date.now() - startTimestamp)/1000);
    clockDisplay.textContent = formatHMS(elapsed);
    updateEarningsPanel(elapsed);
  }

  function stopTicking(){
    clearInterval(timerInterval);
    timerInterval = null;
    clockDisplay.classList.remove("running");
    clockStatus.classList.remove("running");
    clockStatus.textContent = "Pronto para começar";
    btnToggle.classList.remove("running");
    btnToggleLabel.textContent = "Iniciar";
    clockDisplay.textContent = "00:00:00";
  }

  btnToggle.addEventListener("click", () => {
    if(startTimestamp === null){
      // iniciar
      startTimestamp = Date.now();
      localStorage.setItem(TIMER_STATE_KEY, JSON.stringify({ startTimestamp }));
      beginTicking();
    } else {
      // finalizar e salvar
      const elapsedSeconds = Math.floor((Date.now() - startTimestamp)/1000);
      if(elapsedSeconds > 0){
        records.push({ date: todayISO(), seconds: elapsedSeconds });
        saveRecords(records);
      }
      startTimestamp = null;
      localStorage.removeItem(TIMER_STATE_KEY);
      stopTicking();
      updateEarningsPanel();
    }
  });

  /* ---------------- PAINEL DE GANHOS ---------------- */
  const statHours = document.getElementById("stat-hours");
  const statMoney = document.getElementById("stat-money");
  const statRate = document.getElementById("stat-rate");
  const progressFill = document.getElementById("progress-fill");
  const progressCaption = document.getElementById("progress-caption");

  function secondsWorkedInMonth(monthKey, extraSeconds){
    let total = records
      .filter(r => monthKeyOf(r.date) === monthKey)
      .reduce((sum, r) => sum + r.seconds, 0);
    if(extraSeconds) total += extraSeconds;
    return total;
  }

  function updateEarningsPanel(runningElapsedSeconds){
    const now = new Date();
    const monthKey = currentMonthKey();
    const secondsThisMonth = secondsWorkedInMonth(monthKey, runningElapsedSeconds);
    const hoursThisMonth = secondsThisMonth / 3600;

    const workDaysSet = new Set(config.workDays || []);
    const workDaysInMonth = countWorkDaysInMonth(now.getFullYear(), now.getMonth(), workDaysSet);
    const monthGoalHours = workDaysInMonth * (config.hoursPerDay || 0);
    const hourlyRate = monthGoalHours > 0 ? (config.salary || 0) / monthGoalHours : 0;
    const earned = hourlyRate * hoursThisMonth;
    const progressPct = monthGoalHours > 0 ? Math.min(100, (hoursThisMonth/monthGoalHours)*100) : 0;

    statHours.textContent = formatHoursMinutes(secondsThisMonth);
    statMoney.textContent = formatMoney(earned);
    statRate.textContent = formatMoney(hourlyRate);
    progressFill.style.width = `${progressPct}%`;
    progressCaption.textContent = monthGoalHours > 0
      ? `${progressPct.toFixed(0)}% do mês trabalhado`
      : `configure salário e dias na aba Configurar`;
  }

  /* ---------------- INTERVALO (TEMPORIZADOR + ALARME) ---------------- */
  const breakIdle = document.getElementById("break-idle");
  const breakActive = document.getElementById("break-active");
  const breakMinutesInput = document.getElementById("break-minutes");
  const breakCountdown = document.getElementById("break-countdown");
  const btnBreakStart = document.getElementById("btn-break-start");
  const btnBreakCancel = document.getElementById("btn-break-cancel");
  const flashOverlay = document.getElementById("flash-overlay");

  let breakInterval = null;
  let breakEndTimestamp = null;
  let alarmRinging = false;
  let audioCtx = null;
  let beepInterval = null;

  function playBeep(){
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    setTimeout(()=> osc.stop(), 220);
  }

  function startBreak(){
    const minutes = parseFloat(breakMinutesInput.value);
    if(!minutes || minutes <= 0) return;
    breakEndTimestamp = Date.now() + minutes*60*1000;
    breakIdle.classList.add("hidden");
    breakActive.classList.remove("hidden");
    tickBreak();
    breakInterval = setInterval(tickBreak, 1000);
  }

  function tickBreak(){
    const remaining = Math.max(0, Math.round((breakEndTimestamp - Date.now())/1000));
    const m = Math.floor(remaining/60);
    const s = remaining%60;
    breakCountdown.textContent = `${pad(m)}:${pad(s)}`;
    if(remaining <= 0){
      clearInterval(breakInterval);
      breakInterval = null;
      ringAlarm();
    }
  }

  function ringAlarm(){
    alarmRinging = true;
    breakCountdown.textContent = "00:00";
    flashOverlay.classList.add("flashing");
    btnBreakCancel.textContent = "Parar alarme";
    playBeep();
    beepInterval = setInterval(playBeep, 700);
  }

  function stopAlarmAndReset(){
    clearInterval(breakInterval);
    clearInterval(beepInterval);
    breakInterval = null;
    beepInterval = null;
    alarmRinging = false;
    flashOverlay.classList.remove("flashing");
    btnBreakCancel.textContent = "Cancelar";
    breakActive.classList.add("hidden");
    breakIdle.classList.remove("hidden");
  }

  btnBreakStart.addEventListener("click", startBreak);
  btnBreakCancel.addEventListener("click", stopAlarmAndReset);

  /* ---------------- HISTÓRICO ---------------- */
  const monthSelect = document.getElementById("month-select");
  const monthSummary = document.getElementById("month-summary");
  const historyList = document.getElementById("history-list");

  function allMonthsAvailable(){
    const set = new Set(records.map(r => monthKeyOf(r.date)));
    set.add(currentMonthKey());
    return [...set].sort().reverse();
  }

  function monthLabel(key){
    const [y,m] = key.split("-").map(Number);
    const d = new Date(y, m-1, 1);
    const label = d.toLocaleDateString("pt-BR", { month:"long", year:"numeric" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function renderHistory(){
    const months = allMonthsAvailable();
    const prevSelected = monthSelect.value;
    monthSelect.innerHTML = "";
    months.forEach(key => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = monthLabel(key);
      monthSelect.appendChild(opt);
    });
    monthSelect.value = months.includes(prevSelected) ? prevSelected : currentMonthKey();
    renderMonthDetails(monthSelect.value);
  }

  monthSelect.addEventListener("change", () => renderMonthDetails(monthSelect.value));

  function renderMonthDetails(monthKey){
    const monthRecords = records.filter(r => monthKeyOf(r.date) === monthKey);

    // agrupar por dia
    const byDay = {};
    monthRecords.forEach(r => {
      byDay[r.date] = (byDay[r.date] || 0) + r.seconds;
    });
    const days = Object.keys(byDay).sort().reverse();

    const totalSeconds = monthRecords.reduce((s,r)=>s+r.seconds,0);
    const [y,m] = monthKey.split("-").map(Number);
    const workDaysSet = new Set(config.workDays || []);
    const workDaysInMonth = countWorkDaysInMonth(y, m-1, workDaysSet);
    const monthGoalHours = workDaysInMonth * (config.hoursPerDay || 0);
    const hourlyRate = monthGoalHours > 0 ? (config.salary || 0) / monthGoalHours : 0;
    const earned = hourlyRate * (totalSeconds/3600);

    monthSummary.innerHTML = `
      <div class="msum-item">
        <span class="msum-value">${formatHoursMinutes(totalSeconds)}</span>
        <span class="msum-label">total no mês</span>
      </div>
      <div class="msum-item">
        <span class="msum-value">${formatMoney(earned)}</span>
        <span class="msum-label">ganho no mês</span>
      </div>
      <div class="msum-item">
        <span class="msum-value">${days.length}</span>
        <span class="msum-label">dias trabalhados</span>
      </div>
    `;

    if(days.length === 0){
      historyList.innerHTML = `<div class="history-empty">Nenhum registro neste mês ainda.</div>`;
      return;
    }

    historyList.innerHTML = days.map(dateISO => {
      const [yy,mm,dd] = dateISO.split("-").map(Number);
      const dObj = new Date(yy, mm-1, dd);
      const weekday = WEEKDAY_NAMES[dObj.getDay()];
      return `
        <div class="ticket">
          <div class="ticket-date">
            <span class="ticket-day">${pad(dd)}/${pad(mm)}</span>
            <span class="ticket-weekday">${weekday}</span>
          </div>
          <span class="ticket-hours">${formatHoursMinutes(byDay[dateISO])}</span>
        </div>
      `;
    }).join("");
  }

  /* ---------------- INIT ---------------- */
  renderConfigForm();
  updateEarningsPanel();
  restoreRunningTimer();

  // mantém o painel de ganhos atualizado mesmo parado (ex: virar o mês)
  setInterval(() => {
    if(startTimestamp === null) updateEarningsPanel();
  }, 30000);

})();
