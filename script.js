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

  const PROFILE_KEY = "ponto_profile_v1";
  function loadProfile(){
    try{
      const raw = localStorage.getItem(PROFILE_KEY);
      if(!raw) return { name: "", photo: "" };
      return JSON.parse(raw);
    }catch(e){
      return { name: "", photo: "" };
    }
  }
  function saveProfile(p){
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  }

  let config = loadConfig();
  let records = loadRecords();
  let profile = loadProfile();

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

  // calcula o valor da hora de um mês específico, usando uma configuração dada
  function hourlyRateForMonth(monthKey, cfg){
    const [y,m] = monthKey.split("-").map(Number);
    const workDaysSet = new Set(cfg.workDays || []);
    const workDaysInMonth = countWorkDaysInMonth(y, m-1, workDaysSet);
    const monthGoalHours = workDaysInMonth * (cfg.hoursPerDay || 0);
    return monthGoalHours > 0 ? (cfg.salary || 0) / monthGoalHours : 0;
  }

  /* ---------------- TEMA ---------------- */
  const THEME_KEY = "ponto_theme_v1";
  const themeToggle = document.getElementById("theme-toggle");
  const themeToggleIcon = document.getElementById("theme-toggle-icon");
  const metaThemeColor = document.getElementById("meta-theme-color");

  function applyTheme(theme){
    document.documentElement.setAttribute("data-theme", theme);
    themeToggleIcon.textContent = theme === "light" ? "☀" : "☾";
    metaThemeColor.setAttribute("content", theme === "light" ? "#eef0f3" : "#14171c");
  }

  function loadTheme(){
    return localStorage.getItem(THEME_KEY) || "dark";
  }

  let currentTheme = loadTheme();
  applyTheme(currentTheme);

  themeToggle.addEventListener("click", () => {
    currentTheme = currentTheme === "light" ? "dark" : "light";
    localStorage.setItem(THEME_KEY, currentTheme);
    applyTheme(currentTheme);
  });

  /* ---------------- VERSÃO (gatilho oculto) ---------------- */
  const APP_VERSION = "1.0";
  const brandMarkBtn = document.getElementById("brand-mark-btn");
  const brandVersion = document.getElementById("brand-version");
  let versionTapCount = 0;
  let versionTapTimer = null;

  brandVersion.textContent = `v${APP_VERSION}`;

  brandMarkBtn.addEventListener("click", () => {
    versionTapCount++;
    clearTimeout(versionTapTimer);
    versionTapTimer = setTimeout(() => { versionTapCount = 0; }, 1500);

    if(versionTapCount >= 5){
      versionTapCount = 0;
      brandVersion.classList.remove("hidden");
      clearTimeout(brandVersion._hideTimer);
      brandVersion._hideTimer = setTimeout(() => {
        brandVersion.classList.add("hidden");
      }, 4000);
    }
  });

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

  /* ---------------- PERFIL ---------------- */
  const inputName = document.getElementById("input-name");
  const profilePhotoBtn = document.getElementById("profile-photo-btn");
  const profilePhotoImg = document.getElementById("profile-photo-img");
  const profilePhotoPlaceholder = document.getElementById("profile-photo-placeholder");
  const profilePhotoInput = document.getElementById("profile-photo-input");
  const brandUserPhoto = document.getElementById("brand-user-photo");
  const brandUserName = document.getElementById("brand-user-name");

  function renderProfile(){
    inputName.value = profile.name || "";

    if(profile.photo){
      profilePhotoImg.src = profile.photo;
      profilePhotoImg.classList.remove("hidden");
      profilePhotoPlaceholder.classList.add("hidden");
      brandUserPhoto.src = profile.photo;
      brandUserPhoto.classList.remove("hidden");
    } else {
      profilePhotoImg.classList.add("hidden");
      profilePhotoPlaceholder.classList.remove("hidden");
      brandUserPhoto.classList.add("hidden");
    }
    brandUserName.textContent = profile.name || "";
  }

  profilePhotoBtn.addEventListener("click", () => profilePhotoInput.click());

  profilePhotoInput.addEventListener("change", () => {
    const file = profilePhotoInput.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      profile.photo = reader.result;
      saveProfile(profile);
      renderProfile();
    };
    reader.readAsDataURL(file);
  });

  inputName.addEventListener("input", () => {
    profile.name = inputName.value;
    saveProfile(profile);
    brandUserName.textContent = profile.name || "";
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
        const dateISO = todayISO();
        const rate = hourlyRateForMonth(monthKeyOf(dateISO), config);
        records.push({ date: dateISO, seconds: elapsedSeconds, rate });
        saveRecords(records);
      }
      startTimestamp = null;
      localStorage.removeItem(TIMER_STATE_KEY);
      stopTicking();
      updateEarningsPanel();
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if(startTimestamp !== null){
      e.preventDefault();
      e.returnValue = "";
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

  // soma os ganhos de um mês usando a taxa travada de cada registro
  // (registros antigos sem taxa salva usam a taxa atual como aproximação)
  function earnedInMonth(monthKey, cfg, runningElapsedSeconds){
    let total = records
      .filter(r => monthKeyOf(r.date) === monthKey)
      .reduce((sum, r) => {
        const rate = (typeof r.rate === "number") ? r.rate : hourlyRateForMonth(monthKey, cfg);
        return sum + (r.seconds/3600) * rate;
      }, 0);
    if(runningElapsedSeconds){
      total += (runningElapsedSeconds/3600) * hourlyRateForMonth(monthKey, cfg);
    }
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
    const currentRate = hourlyRateForMonth(monthKey, config);
    const earned = earnedInMonth(monthKey, config, runningElapsedSeconds);
    const progressPct = monthGoalHours > 0 ? Math.min(100, (hoursThisMonth/monthGoalHours)*100) : 0;

    statHours.textContent = formatHoursMinutes(secondsThisMonth);
    statMoney.textContent = formatMoney(earned);
    statRate.textContent = formatMoney(currentRate);
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
    const earned = earnedInMonth(monthKey, config);

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

  /* ---------------- BACKUP ---------------- */
  const btnExport = document.getElementById("btn-export");
  const btnImport = document.getElementById("btn-import");
  const importFileInput = document.getElementById("import-file-input");
  const importConfirm = document.getElementById("import-confirm");

  btnExport.addEventListener("click", () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      config, records, profile
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = todayISO();
    a.href = url;
    a.download = `ponto-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  btnImport.addEventListener("click", () => importFileInput.click());

  importFileInput.addEventListener("change", () => {
    const file = importFileInput.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const data = JSON.parse(reader.result);
        if(data.config) { config = data.config; saveConfig(config); }
        if(Array.isArray(data.records)) { records = data.records; saveRecords(records); }
        if(data.profile) { profile = data.profile; saveProfile(profile); }

        renderProfile();
        renderConfigForm();
        updateEarningsPanel();
        renderHistory();

        importConfirm.classList.remove("hidden");
        setTimeout(()=>importConfirm.classList.add("hidden"), 2500);
      }catch(e){
        alert("Não foi possível ler esse arquivo de backup.");
      }
    };
    reader.readAsText(file);
    importFileInput.value = "";
  });

  /* ---------------- ZONA DE RISCO ---------------- */
  const btnResetAll = document.getElementById("btn-reset-all");

  btnResetAll.addEventListener("click", () => {
    const step1 = confirm("Apagar TODOS os dados (perfil, configuração e histórico)? Essa ação não pode ser desfeita.");
    if(!step1) return;
    const step2 = confirm("Tem certeza mesmo? Não vai dar pra recuperar depois.");
    if(!step2) return;

    localStorage.removeItem(CONFIG_KEY);
    localStorage.removeItem(RECORDS_KEY);
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(TIMER_STATE_KEY);
    localStorage.removeItem(THEME_KEY);
    location.reload();
  });

  /* ---------------- INIT ---------------- */
  renderProfile();
  renderConfigForm();
  updateEarningsPanel();
  restoreRunningTimer();

  // mantém o painel de ganhos atualizado mesmo parado (ex: virar o mês)
  setInterval(() => {
    if(startTimestamp === null) updateEarningsPanel();
  }, 30000);

})();
