const config = {
  invitationMessage: "Давай насладимся новым гастрономическим опытом вместе и попробуем, какие звёзды на вкус.",
  eventTitle: "Наш ужин в честь годовщины",
  startIso: "2026-08-27T19:15:00+02:00",
  endIso: "2026-08-27T22:15:00+02:00",
  timeZone: "Europe/Amsterdam",
  meetingText: "Restaurant Vinkeles",
  revealedLocation: "Restaurant Vinkeles",
  dressSuggestion: "То, в чём ты чувствуешь себя прекрасно",
  maximumAttempts: 4,
};

const STORAGE_KEY = "anniversary-invitation:v1";
const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const bushAnimationDuration = prefersReducedMotion ? 60 : 600;

const elements = {
  scene: document.querySelector("#scene"),
  intro: document.querySelector("#intro-view"),
  chase: document.querySelector("#chase-view"),
  invitation: document.querySelector("#invitation-view"),
  accepted: document.querySelector("#accepted-view"),
  start: document.querySelector("#start-button"),
  restart: document.querySelector("#restart-button"),
  skip: document.querySelector("#skip-button"),
  dog: document.querySelector("#dog-button"),
  field: document.querySelector("#game-field"),
  dogButton: document.querySelector("#dog-button"),
  cheer: document.querySelector("#cheer-bubble"),
  bushes: [...document.querySelectorAll(".bush")],
  feedback: document.querySelector("#feedback-message"),
  accept: document.querySelector("#accept-button"),
  calendar: document.querySelector("#calendar-button"),
  announcement: document.querySelector("#announcement"),
  eventDate: document.querySelector("#event-date"),
  eventLocation: document.querySelector("#event-location"),
  eventDress: document.querySelector("#event-dress"),
  acceptedDate: document.querySelector("#accepted-date"),
  acceptedLocation: document.querySelector("#accepted-location"),
  invitationMessage: document.querySelector("#invitation-message"),
};
let state = {
  screen: "intro",
  attempts: 0,
  inputLocked: false,
  dogHidden: false,
  hiddenBush: null,
};
let wanderTimer = null;
let cheerTimer = null;
let lastEvasionAt = 0;
let cursorPollTimer = null;
let pointerPosition = null;
let runTimer = null;
let idleTimer = null;
let hideTimer = null;
const bushAnimationCancels = new WeakMap();

const missMessages = [
  "Почти! Она очень быстрая и хочет доставить приглашение.",
  "Она начинает волноваться. Попробуй ещё раз.",
  "Так близко! Ей всё сложнее найти место для побега.",
];

function readStoredState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {};
  } catch {
    return {};
  }
}

function writeStoredState(nextState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // The experience remains usable in private browsing or restricted storage.
  }
}

function announce(message) {
  elements.announcement.textContent = "";
  window.setTimeout(() => { elements.announcement.textContent = message; }, 20);
}

function setScreen(screen) {
  state.screen = screen;
  const views = { intro: elements.intro, chase: elements.chase, invitation: elements.invitation, accepted: elements.accepted };
  const activeViewName = screen === "chasing" || screen === "moving" ? "chase" : screen;
  document.body.classList.toggle("screen--chasing", activeViewName === "chase");
  Object.entries(views).forEach(([name, view]) => { view.hidden = name !== activeViewName; });
  const activeView = views[activeViewName] || views.intro;
  if (activeView) activeView.hidden = false;
}

function updateDetails() {
  const date = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: config.timeZone }).format(new Date(config.startIso));
  const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: config.timeZone }).format(new Date(config.startIso));
  const formatted = `${date} ${time}`;
  elements.eventDate.textContent = formatted;
  elements.acceptedDate.textContent = formatted;
  elements.eventLocation.textContent = config.meetingText;
  elements.eventDress.textContent = config.dressSuggestion;
  elements.invitationMessage.textContent = config.invitationMessage;
  elements.acceptedLocation.textContent = config.revealedLocation;
}

function getFieldPosition() {
  const fieldRect = elements.field.getBoundingClientRect();
  const dogWidth = elements.dogButton.offsetWidth || 112;
  const dogHeight = elements.dogButton.offsetHeight || 96;
  const horizontalInset = Math.max(22, fieldRect.width * 0.08);
  const verticalInset = Math.max(12, fieldRect.height * 0.03);
  // Keep the dog on the green foreground while allowing the full grass area
  // from its upper edge down to the bottom of the field.
  const minY = Math.max(120, fieldRect.height * 0.57);
  const maxY = Math.max(minY, fieldRect.height - dogHeight - verticalInset);
  const maxX = Math.max(horizontalInset, fieldRect.width - dogWidth - horizontalInset);
  return { fieldRect, dogWidth, dogHeight, minX: horizontalInset, maxX, minY, maxY };
}

function placeDog(position, commit = true) {
  const bounds = getFieldPosition();
  const previousX = parseFloat(getComputedStyle(elements.dog).getPropertyValue("--dog-x"));
  const x = Math.max(bounds.minX, Math.min(position.x, bounds.maxX));
  const y = Math.max(bounds.minY, Math.min(position.y, bounds.maxY));
  if (commit) {
    if (Number.isFinite(previousX) && Math.abs(x - previousX) > 4) elements.dog.classList.toggle("dog--facing-right", x > previousX);
    elements.dog.style.setProperty("--dog-x", `${x}px`);
    elements.dog.style.setProperty("--dog-y", `${y}px`);
  }
  return { x, y };
}

function getDogPosition() {
  const bounds = getFieldPosition();
  return {
    x: parseFloat(getComputedStyle(elements.dog).getPropertyValue("--dog-x")) || bounds.fieldRect.width / 2,
    y: parseFloat(getComputedStyle(elements.dog).getPropertyValue("--dog-y")) || bounds.fieldRect.height / 2,
  };
}

function getTravelDuration(distance) {
  if (prefersReducedMotion) return 100;
  // Keep the dog moving at a readable pace instead of allowing long jumps
  // to complete in the same time as short escapes.
  return Math.round(Math.max(420, Math.min(1100, 380 + distance * 2.15)));
}

function clearHideTimer() {
  if (hideTimer !== null) window.clearTimeout(hideTimer);
  hideTimer = null;
}

function returnDogToField() {
  if (elements.dogButton.parentElement !== elements.field) elements.field.append(elements.dogButton);
  elements.dogButton.classList.remove("dog-button--in-bush", "dog-button--releasing");
}

function playBushJump(bush) {
  bushAnimationCancels.get(bush)?.();
  return new Promise((resolve) => {
    let fallbackTimer = null;
    const finish = () => {
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      bush.removeEventListener("animationend", onAnimationEnd);
      bush.classList.remove("bush--jumping");
      if (bushAnimationCancels.get(bush) === finish) bushAnimationCancels.delete(bush);
      resolve();
    };
    const onAnimationEnd = (event) => {
      if (event.animationName === "bush-jump") finish();
    };

    bush.addEventListener("animationend", onAnimationEnd);
    bushAnimationCancels.set(bush, finish);
    bush.classList.remove("bush--jumping");
    // Restart the one-shot sprite animation if this bush was used recently.
    void bush.offsetWidth;
    bush.classList.add("bush--jumping");
    // Keep the interaction reliable if animation events are unavailable.
    fallbackTimer = window.setTimeout(finish, bushAnimationDuration + 80);
  });
}

function playDogBushPeek() {
  return new Promise((resolve) => {
    let fallbackTimer = null;
    const finish = () => {
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      elements.dogButton.removeEventListener("animationend", onAnimationEnd);
      elements.dogButton.classList.remove("dog-button--releasing");
      resolve();
    };
    const onAnimationEnd = (event) => {
      if (event.animationName === "dog-bush-peek") finish();
    };

    elements.dogButton.addEventListener("animationend", onAnimationEnd);
    elements.dogButton.classList.remove("dog-button--releasing");
    // Restart the one-shot peek animation if this dog was used recently.
    void elements.dogButton.offsetWidth;
    elements.dogButton.classList.add("dog-button--releasing");
    fallbackTimer = window.setTimeout(finish, bushAnimationDuration + 80);
  });
}

function getNearbyBush(position) {
  const fieldRect = elements.field.getBoundingClientRect();
  const dogCenter = {
    x: position.x + elements.dogButton.offsetWidth / 2,
    y: position.y + elements.dogButton.offsetHeight * 0.66,
  };
  // Bushes should be a fun occasional hiding spot, not an automatic trap
  // whenever the dog passes somewhere nearby.
  const proximity = Math.max(52, Math.min(82, fieldRect.width * 0.085));
  let closest = null;
  let closestDistance = Infinity;
  elements.bushes.forEach((bush) => {
    const bushRect = bush.getBoundingClientRect();
    const bushCenter = {
      x: bushRect.left - fieldRect.left + bushRect.width / 2,
      y: bushRect.top - fieldRect.top + bushRect.height * 0.72,
    };
    const distance = Math.hypot(dogCenter.x - bushCenter.x, dogCenter.y - bushCenter.y);
    if (distance < proximity && distance < closestDistance) {
      closest = bush;
      closestDistance = distance;
    }
  });
  return closest;
}

function getBushFootprint(bush, fieldRect) {
  const bushRect = bush.getBoundingClientRect();
  const idleShift = parseFloat(getComputedStyle(bush).getPropertyValue("--bush-idle-shift")) || 0;
  // The bush element includes transparent sprite padding. Keep the collision
  // footprint close to the visible foliage and its ground shadow instead of
  // treating the whole frame as an occupied rectangle.
  const horizontalInset = bushRect.width * 0.08;
  const topInset = bushRect.height * 0.16;
  return {
    left: bushRect.left - fieldRect.left + horizontalInset,
    top: bushRect.top - fieldRect.top + topInset,
    right: bushRect.right - fieldRect.left - horizontalInset,
    bottom: bushRect.bottom - fieldRect.top + idleShift,
  };
}

function isClearGrassPosition(position, excludedBush = null) {
  const bounds = getFieldPosition();
  const clearance = Math.max(18, Math.min(32, bounds.fieldRect.width * 0.03));
  const dogBox = {
    left: position.x - clearance,
    top: position.y - clearance,
    right: position.x + bounds.dogWidth + clearance,
    bottom: position.y + bounds.dogHeight + clearance,
  };

  return elements.bushes.every((bush) => {
    if (bush === excludedBush) return true;
    const footprint = getBushFootprint(bush, bounds.fieldRect);
    return dogBox.right < footprint.left
      || dogBox.left > footprint.right
      || dogBox.bottom < footprint.top
      || dogBox.top > footprint.bottom;
  });
}

function placeDogInClearGrass(excludedBush = null) {
  const bounds = getFieldPosition();
  const preferredY = [
    bounds.maxY,
    bounds.minY + (bounds.maxY - bounds.minY) * 0.82,
    bounds.minY + (bounds.maxY - bounds.minY) * 0.62,
  ];
  const preferredX = [
    bounds.minX,
    bounds.fieldRect.width * 0.18,
    bounds.fieldRect.width * 0.38,
    bounds.fieldRect.width * 0.52,
    bounds.fieldRect.width * 0.68,
    bounds.maxX,
  ];

  // Try a small grid first so the release reliably lands in a visibly open
  // patch of grass instead of depending on a lucky random position.
  for (const y of preferredY) {
    for (const x of preferredX) {
      const candidate = placeDog({ x, y }, false);
      if (isClearGrassPosition(candidate, excludedBush)) return candidate;
    }
  }

  // The grid is supplemented with random points for wider fields and for
  // responsive layouts where the bush positions change with the viewport.
  for (let attempt = 0; attempt < 36; attempt += 1) {
    const candidate = placeDog({
      x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
      y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
    }, false);
    if (isClearGrassPosition(candidate, excludedBush)) return candidate;
  }

  // Keep the release inside the field even if an unusually narrow viewport
  // leaves no fully clear candidate after the collision checks.
  return placeDog({ x: bounds.fieldRect.width * 0.5, y: bounds.maxY }, false);
}

function hideDogInBush(bush) {
  hideTimer = null;
  if (!["chasing", "moving"].includes(state.screen) || (state.inputLocked && state.screen !== "moving") || state.dogHidden) return;
  state.dogHidden = true;
  state.hiddenBush = bush.dataset.bush;
  state.inputLocked = false;
  state.screen = "chasing";
  setScreen("chasing");
  stopDogRun();
  playBushJump(bush);
  bush.classList.add("bush--occupied");
  bush.append(elements.dogButton);
  elements.dogButton.classList.add("dog-button--in-bush");
  elements.dogButton.classList.add("dog-button--hidden");
  elements.feedback.textContent = "Она спряталась! Нажми на куст, чтобы её выпустить.";
  showCheerBubble("Нажми на куст!", getDogPosition());
  announce("Собака спряталась в кусте. Нажми на куст, чтобы её выпустить.");
}

function queueBushHide(position, duration) {
  if (!["chasing", "moving"].includes(state.screen) || (state.inputLocked && state.screen !== "moving") || state.dogHidden) return;
  const bush = getNearbyBush(position);
  if (!bush) return;
  clearHideTimer();
  hideTimer = window.setTimeout(() => hideDogInBush(bush), Math.min(900, Math.max(260, duration * 0.8)));
}

function releaseDogFromBush(bush) {
  if (!state.dogHidden || state.inputLocked || bush.dataset.bush !== state.hiddenBush) return;
  clearHideTimer();
  state.inputLocked = true;
  bush.classList.remove("bush--occupied");
  elements.feedback.textContent = "Вот она — куст открывается!";
  showCheerBubble("Вот ты где!", getDogPosition());
  announce("Собака выглядывает из куста.");
  playBushJump(bush).then(() => {
    // The chase may have been reset or skipped while the bush was animating.
    if (!state.dogHidden || bush.dataset.bush !== state.hiddenBush) {
      return;
    }

    // Let the bush finish its jump before the dog peeks out. The running dog
    // is revealed only after this peek, so it clearly escapes from the bush.
    elements.dogButton.classList.remove("dog-button--hidden");
    playDogBushPeek().then(() => {
      if (!state.dogHidden || bush.dataset.bush !== state.hiddenBush) return;

      const current = getDogPosition();
      const nextPosition = placeDogInClearGrass(bush);
      elements.field.append(elements.dogButton);
      returnDogToField();
      elements.dogButton.classList.remove("dog-button--hidden");
      // Establish the visible starting point before changing the destination.
      // This prevents the hidden transform from being replaced by the target
      // position before the escape transition begins.
      placeDog(current);
      const nextFrame = window.requestAnimationFrame || ((callback) => callback());
      nextFrame(() => {
        if (state.screen !== "chasing" || !state.dogHidden || state.hiddenBush !== bush.dataset.bush) return;
        state.inputLocked = false;
        state.dogHidden = false;
        state.hiddenBush = null;
        elements.feedback.textContent = "Она выбралась — скорее!";
        const duration = getTravelDuration(Math.hypot(nextPosition.x - current.x, nextPosition.y - current.y));
        startDogRun(duration);
        placeDog(nextPosition);
        showCheerBubble("Вот она убегает!", nextPosition);
        announce("Собака выбежала из куста и снова убегает.");
      });
    });
  });
}

function placeDogRandomly(commit = true) {
  const bounds = getFieldPosition();
  const current = getDogPosition();
  const ease = Math.min(state.attempts / config.maximumAttempts, 0.75);
  const spread = 1 - ease * 0.6;
  const maximumStep = Math.min(220, Math.max(130, bounds.fieldRect.width * 0.22));
  const minimumStep = Math.min(95, maximumStep * 0.5) * spread;
  let next = current;
  for (let i = 0; i < 12; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = minimumStep + Math.random() * (maximumStep - minimumStep);
    const candidate = {
      x: Math.max(bounds.minX, Math.min(current.x + Math.cos(angle) * distance, bounds.maxX)),
      y: Math.max(bounds.minY, Math.min(current.y + Math.sin(angle) * distance, bounds.maxY)),
    };
    const actualDistance = Math.hypot(candidate.x - current.x, candidate.y - current.y);
    if (actualDistance >= Math.max(34, minimumStep * 0.7) || i === 11) { next = candidate; break; }
  }
  return placeDog(next, commit);
}

function clearWanderTimer() {
  if (wanderTimer !== null) window.clearTimeout(wanderTimer);
  wanderTimer = null;
}

function startCursorPolling() {
  if (cursorPollTimer !== null) window.clearInterval(cursorPollTimer);
  cursorPollTimer = window.setInterval(checkCursorProximity, 90);
}

function stopCursorPolling() {
  if (cursorPollTimer !== null) window.clearInterval(cursorPollTimer);
  cursorPollTimer = null;
  pointerPosition = null;
}

function showCheerBubble(message, position) {
  if (!elements.cheer) return;
  if (cheerTimer !== null) window.clearTimeout(cheerTimer);
  const bounds = elements.field.getBoundingClientRect();
  const bubbleWidth = 145;
  const left = Math.max(12, Math.min(position.x - bubbleWidth - 28, bounds.width - bubbleWidth - 12));
  const top = Math.max(62, position.y - 8);
  elements.cheer.textContent = message;
  elements.cheer.style.left = `${left}px`;
  elements.cheer.style.top = `${top}px`;
  elements.cheer.classList.remove("is-visible");
  const nextFrame = window.requestAnimationFrame || ((callback) => callback());
  nextFrame(() => elements.cheer.classList.add("is-visible"));
  cheerTimer = window.setTimeout(() => elements.cheer.classList.remove("is-visible"), 1350);
}

function setDogSpeed(duration) {
  elements.dogButton.style.setProperty("--dog-duration", `${duration}ms`);
  elements.dog.style.setProperty("--dog-sprite-duration", `${Math.max(280, duration * 0.72)}ms`);
}

function stopDogRun() {
  if (runTimer !== null) window.clearTimeout(runTimer);
  runTimer = null;
  if (idleTimer !== null) window.clearTimeout(idleTimer);
  idleTimer = null;
  elements.dogButton.classList.remove("dog-button--running");
  elements.dogButton.classList.remove("dog-button--idle-sitting");
}

function setDogIdle() {
  if (runTimer !== null) window.clearTimeout(runTimer);
  runTimer = null;
  if (idleTimer !== null) window.clearTimeout(idleTimer);
  elements.dogButton.classList.remove("dog-button--running", "dog-button--idle-sitting");
  idleTimer = window.setTimeout(() => {
    idleTimer = null;
    if (state.screen === "chasing" && !elements.dogButton.classList.contains("dog-button--running")) elements.dogButton.classList.add("dog-button--idle-sitting");
  }, prefersReducedMotion ? 0 : 500);
}

function startDogRun(duration) {
  stopDogRun();
  elements.dogButton.classList.add("dog-button--running");
  setDogSpeed(duration);
  runTimer = window.setTimeout(() => {
    runTimer = null;
    if (state.screen === "chasing") setDogIdle();
  }, duration);
}

function randomRunDuration() {
  return Math.round(430 + Math.random() * 620);
}

function scheduleDogWander(delay = 1100) {
  clearWanderTimer();
  wanderTimer = window.setTimeout(() => {
    if (state.screen !== "chasing" || state.inputLocked) return;
    const current = getDogPosition();
    const nextPosition = placeDogRandomly(false);
    const duration = prefersReducedMotion ? 120 : Math.max(randomRunDuration(), getTravelDuration(Math.hypot(nextPosition.x - current.x, nextPosition.y - current.y)));
    startDogRun(duration);
    placeDog(nextPosition);
    queueBushHide(nextPosition, duration);
    showCheerBubble(["Слишком медленно! ✦", "Продолжай погоню!", "Ещё немного!", "Вперёд, вперёд!"][Math.floor(Math.random() * 4)], nextPosition);
  }, delay);
}

function startChase() {
  clearWanderTimer();
  startCursorPolling();
  clearHideTimer();
  returnDogToField();
  state = { screen: "chasing", attempts: 0, inputLocked: false, dogHidden: false, hiddenBush: null };
  elements.bushes.forEach((bush) => bush.classList.remove("bush--jumping", "bush--occupied"));
  elements.feedback.textContent = "Она прямо там — скорее!";
  stopDogRun();
  setDogIdle();
  setScreen("chasing");
  const nextFrame = window.requestAnimationFrame || ((callback) => callback());
  nextFrame(() => {
    placeDog({ x: elements.field.clientWidth * 0.52, y: elements.field.clientHeight * 0.42 });
    elements.dog.focus({ preventScroll: true });
    scheduleDogWander(prefersReducedMotion ? 250 : 700);
  });
  announce("Погоня началась. Нажми или кликни на собаку, чтобы её поймать.");
}

function catchDog() {
  if (state.inputLocked || !["chasing", "moving"].includes(state.screen)) return;
  clearWanderTimer();
  clearHideTimer();
  stopCursorPolling();
  stopDogRun();
  const hiddenBush = elements.bushes.find((bush) => bush.dataset.bush === state.hiddenBush);
  hiddenBush?.classList.remove("bush--jumping", "bush--occupied");
  returnDogToField();
  state.inputLocked = true;
  state.dogHidden = false;
  state.hiddenBush = null;
  elements.dogButton.classList.remove("dog-button--hidden");
  state.screen = "invitation";
  setScreen("invitation");
  elements.accept.focus({ preventScroll: true });
  announce("Собака поймана. Твоё приглашение готово.");
}

function missDog() {
  if (state.inputLocked || state.screen !== "chasing") return;
  state.attempts = Math.min(state.attempts + 1, config.maximumAttempts);
  state.inputLocked = true;
  state.screen = "moving";
  elements.feedback.textContent = state.attempts >= config.maximumAttempts
    ? "Она всё ещё на свободе — попробуй нажать на неё или пропусти погоню."
    : missMessages[state.attempts - 1] || missMessages.at(-1);
  setScreen("moving");
  announce(elements.feedback.textContent);
  const current = getDogPosition();
  const nextPosition = placeDogRandomly(false);
  const duration = prefersReducedMotion ? 100 : getTravelDuration(Math.hypot(nextPosition.x - current.x, nextPosition.y - current.y));
  startDogRun(duration);
  placeDog(nextPosition);
  queueBushHide(nextPosition, duration);
  showCheerBubble(elements.feedback.textContent, nextPosition);
  const delay = prefersReducedMotion ? 100 : 650 - state.attempts * 80;
  window.setTimeout(() => {
    state.inputLocked = false;
    state.screen = "chasing";
    if (!state.dogHidden) setDogIdle();
    setScreen("chasing");
    elements.dog.focus({ preventScroll: true });
  }, delay);
}

function trackCursor(event) {
  if (event.pointerType !== "mouse") return;
  pointerPosition = { clientX: event.clientX, clientY: event.clientY };
}

function checkCursorProximity() {
  if (!pointerPosition || state.screen !== "chasing" || state.inputLocked || state.dogHidden) return;
  const now = Date.now();
  if (now - lastEvasionAt < 420) return;
  const dogRect = elements.dog.getBoundingClientRect();
  const dogCenter = { x: dogRect.left + dogRect.width / 2, y: dogRect.top + dogRect.height / 2 };
  const distance = Math.hypot(dogCenter.x - pointerPosition.clientX, dogCenter.y - pointerPosition.clientY);
  if (distance > 150) return;

  lastEvasionAt = now;
  const bounds = getFieldPosition();
  const fieldRect = bounds.fieldRect;
  const pointerX = pointerPosition.clientX - fieldRect.left;
  const pointerY = pointerPosition.clientY - fieldRect.top;
  const currentX = parseFloat(getComputedStyle(elements.dog).getPropertyValue("--dog-x")) || fieldRect.width / 2;
  const currentY = parseFloat(getComputedStyle(elements.dog).getPropertyValue("--dog-y")) || fieldRect.height / 2;
  const currentCenter = { x: currentX + elements.dogButton.offsetWidth / 2, y: currentY + elements.dogButton.offsetHeight / 2 };
  const awayX = currentCenter.x - pointerX;
  const awayY = currentCenter.y - pointerY;
  const awayDistance = Math.hypot(awayX, awayY) || 1;
  const jump = 125 + Math.random() * 90;
  let nextPosition = placeDog({ x: currentX + (awayX / awayDistance) * jump, y: currentY + (awayY / awayDistance) * jump + (Math.random() - .5) * 70 }, false);
  if (Math.hypot(nextPosition.x - currentX, nextPosition.y - currentY) < 35) nextPosition = placeDogRandomly(false);
  const duration = prefersReducedMotion ? 100 : getTravelDuration(Math.hypot(nextPosition.x - currentX, nextPosition.y - currentY));
  startDogRun(duration);
  placeDog(nextPosition);
  queueBushHide(nextPosition, duration);
  showCheerBubble("Слишком близко!", nextPosition);
}

function acceptInvitation() {
  setScreen("accepted");
  writeStoredState({ accepted: true });
  announce("Это свидание. Твой ответ сохранён на этом устройстве.");
  elements.calendar.focus({ preventScroll: true });
}

function resetExperience() {
  clearWanderTimer();
  clearHideTimer();
  stopDogRun();
  stopCursorPolling();
  if (cheerTimer !== null) window.clearTimeout(cheerTimer);
  cheerTimer = null;
  elements.cheer?.classList.remove("is-visible");
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* continue without persistence */ }
  returnDogToField();
  state = { screen: "intro", attempts: 0, inputLocked: false, dogHidden: false, hiddenBush: null };
  elements.dogButton.classList.remove("dog-button--running");
  elements.dogButton.classList.remove("dog-button--hidden");
  elements.bushes.forEach((bush) => bush.classList.remove("bush--jumping", "bush--occupied"));
  setScreen("intro");
  elements.start.focus({ preventScroll: true });
  announce("Сюрприз готов начаться заново.");
}

function downloadCalendar() {
  const escapeIcs = (value) => String(value).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const toUtc = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Catch the Lost Dog//Anniversary//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:anniversary-${new Date(config.startIso).getTime()}@catch-the-lost-dog`, `DTSTAMP:${toUtc(new Date().toISOString())}`,
    `DTSTART:${toUtc(config.startIso)}`, `DTEND:${toUtc(config.endIso)}`, `SUMMARY:${escapeIcs(config.eventTitle)}`,
    `DESCRIPTION:${escapeIcs(config.invitationMessage)}`, `LOCATION:${escapeIcs(config.revealedLocation)}`, `X-WR-TIMEZONE:${config.timeZone}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "anniversary-dinner.ics";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce("Календарь скачивается.");
}

elements.start.addEventListener("click", startChase);
elements.restart.addEventListener("click", resetExperience);
elements.skip.addEventListener("click", catchDog);
elements.accept.addEventListener("click", acceptInvitation);
elements.calendar.addEventListener("click", downloadCalendar);
elements.bushes.forEach((bush) => {
  bush.addEventListener("click", (event) => {
    event.stopPropagation();
    releaseDogFromBush(bush);
  });
  bush.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      releaseDogFromBush(bush);
    }
  });
});
elements.dog.addEventListener("click", (event) => { event.stopPropagation(); catchDog(); });
elements.field.addEventListener("click", (event) => {
  if (state.dogHidden) return;
  if (event.target !== elements.dog && !elements.dog.contains(event.target)) missDog();
});
elements.field.addEventListener("pointermove", trackCursor);
elements.field.addEventListener("pointerleave", () => { pointerPosition = null; });
window.addEventListener("resize", () => { if (["chasing", "moving"].includes(state.screen)) placeDog({ x: parseFloat(getComputedStyle(elements.dog).getPropertyValue("--dog-x")) || 0, y: parseFloat(getComputedStyle(elements.dog).getPropertyValue("--dog-y")) || 0 }); });

updateDetails();
if (readStoredState().accepted) setScreen("accepted"); else setScreen("intro");
