(() => {
  const ROUND_SIZE = 10;
  const MAX_LIVES = 3;

  const els = {
    landing: document.getElementById("landing"),
    game: document.getElementById("game"),
    result: document.getElementById("result"),
    modal: document.getElementById("modal-how"),
    btnStart: document.getElementById("btn-start"),
    btnHow: document.getElementById("btn-how"),
    btnStartModal: document.getElementById("btn-start-modal"),
    modalClose: document.getElementById("modal-close"),
    btnHome: document.getElementById("btn-home"),
    btnAgain: document.getElementById("btn-again"),
    btnHomeResult: document.getElementById("btn-home-result"),
    topicSelect: document.getElementById("topic-select"),
    datesCount: document.getElementById("dates-count"),
    progress: document.getElementById("progress"),
    total: document.getElementById("total"),
    score: document.getElementById("score"),
    lives: document.getElementById("lives"),
    topicBadge: document.getElementById("topic-badge"),
    questionText: document.getElementById("question-text"),
    answers: document.getElementById("answers"),
    dropWagon: document.getElementById("drop-wagon"),
    dropSlot: document.getElementById("drop-slot"),
    dropHint: document.getElementById("drop-hint"),
    feedback: document.getElementById("feedback"),
    caravan: document.getElementById("caravan-wrap"),
    hills: document.querySelector(".game-hills"),
    resultTitle: document.getElementById("result-title"),
    resultText: document.getElementById("result-text"),
    wrapper: document.querySelector(".wrapper"),
  };

  const state = {
    pool: [],
    queue: [],
    index: 0,
    score: 0,
    lives: MAX_LIVES,
    current: null,
    options: [],
    locked: false,
  };

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickWrongDates(correct, pool, count = 2) {
    const others = pool.filter((d) => d.date !== correct.date && d.id !== correct.id);
    const sameTopic = others.filter((d) => d.topic === correct.topic);
    const base = sameTopic.length >= count ? sameTopic : others;
    return shuffle(base).slice(0, count).map((d) => d.date);
  }

  function buildOptions(item, pool) {
    const wrong = pickWrongDates(item, pool, 2);
    return shuffle([item.date, ...wrong]);
  }

  function getPoolByTopic(topic) {
    const all = window.HISTORY_DATES || [];
    if (!topic || topic === "all") return all;
    return all.filter((d) => d.topic === topic);
  }

  function fillTopics() {
    const all = window.HISTORY_DATES || [];
    const topics = [...new Set(all.map((d) => d.topic))];
    els.topicSelect.innerHTML =
      `<option value="all">Усі дати (${all.length})</option>` +
      topics
        .map((t) => {
          const n = all.filter((d) => d.topic === t).length;
          return `<option value="${t}">${t} (${n})</option>`;
        })
        .join("");
  }

  function show(view) {
    if (els.wrapper) els.wrapper.hidden = view !== "landing";
    els.game.hidden = view !== "game";
    els.result.hidden = view !== "result";
  }

  async function unlockAudio() {
    if (window.GameAudio) await window.GameAudio.unlock();
  }

  function startGame() {
    unlockAudio();
    const topic = els.topicSelect.value;
    state.pool = getPoolByTopic(topic);
    if (state.pool.length < 3) {
      alert("У цій темі замало дат. Обери іншу тему.");
      return;
    }
    const size = Math.min(ROUND_SIZE, state.pool.length);
    state.queue = shuffle(state.pool).slice(0, size);
    state.index = 0;
    state.score = 0;
    state.lives = MAX_LIVES;
    state.locked = false;
    els.total.textContent = String(state.queue.length);
    els.score.textContent = "0";
    els.lives.textContent = String(MAX_LIVES);
    show("game");
    resetCaravan(true);
    nextQuestion();
  }

  function resetCaravan(animateIn) {
    els.caravan.classList.remove("driving", "enter");
    void els.caravan.offsetWidth;
    if (animateIn) {
      els.caravan.classList.add("enter");
      els.caravan.addEventListener(
        "animationend",
        () => els.caravan.classList.remove("enter"),
        { once: true }
      );
    }
    els.dropWagon.classList.remove("filled", "drag-over");
    els.dropSlot.textContent = "";
    els.dropHint.hidden = false;
    if (els.hills) els.hills.classList.remove("racing");
  }

  function driveCaravanAway() {
    return new Promise((resolve) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        els.caravan.classList.remove("driving");
        if (els.hills) els.hills.classList.remove("racing");
        resolve();
      };
      if (els.hills) els.hills.classList.add("racing");
      if (window.GameAudio) window.GameAudio.playChug(2200);
      els.caravan.classList.remove("enter");
      void els.caravan.offsetWidth;
      els.caravan.classList.add("driving");
      els.caravan.addEventListener("animationend", done, { once: true });
      setTimeout(done, 2400);
    });
  }

  function nextQuestion() {
    if (state.index >= state.queue.length || state.lives <= 0) {
      endGame();
      return;
    }

    state.locked = false;
    state.current = state.queue[state.index];
    state.options = buildOptions(state.current, state.pool);

    els.progress.textContent = String(state.index + 1);
    els.topicBadge.textContent = state.current.topic;
    els.questionText.textContent = state.current.event;
    els.feedback.textContent = "";
    els.feedback.className = "feedback";

    resetCaravan(state.index > 0);
    renderAnswers();
  }

  function renderAnswers() {
    els.answers.innerHTML = "";
    state.options.forEach((date, i) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "answer-card";
      card.draggable = true;
      card.dataset.date = date;
      card.dataset.index = String(i);
      card.textContent = date;

      card.addEventListener("click", () => {
        if (state.locked) return;
        if (window.GameAudio) window.GameAudio.playClick();
        tryAnswer(date, card);
      });

      card.addEventListener("dragstart", (e) => {
        if (state.locked) {
          e.preventDefault();
          return;
        }
        card.classList.add("dragging");
        e.dataTransfer.setData("text/plain", date);
        e.dataTransfer.effectAllowed = "move";
      });

      card.addEventListener("dragend", () => card.classList.remove("dragging"));

      let touchClone = null;
      card.addEventListener(
        "touchstart",
        (e) => {
          if (state.locked) return;
          const touch = e.touches[0];
          touchClone = card.cloneNode(true);
          touchClone.classList.add("dragging");
          Object.assign(touchClone.style, {
            position: "fixed",
            pointerEvents: "none",
            zIndex: "200",
            width: `${card.offsetWidth}px`,
            left: `${touch.clientX - card.offsetWidth / 2}px`,
            top: `${touch.clientY - card.offsetHeight / 2}px`,
          });
          document.body.appendChild(touchClone);
          card.style.opacity = "0.4";
        },
        { passive: true }
      );

      card.addEventListener(
        "touchmove",
        (e) => {
          if (!touchClone) return;
          const touch = e.touches[0];
          touchClone.style.left = `${touch.clientX - touchClone.offsetWidth / 2}px`;
          touchClone.style.top = `${touch.clientY - touchClone.offsetHeight / 2}px`;
          const over = document.elementFromPoint(touch.clientX, touch.clientY);
          els.dropWagon.classList.toggle(
            "drag-over",
            Boolean(over && over.closest("#drop-wagon"))
          );
        },
        { passive: true }
      );

      card.addEventListener("touchend", (e) => {
        if (!touchClone) return;
        const touch = e.changedTouches[0];
        const over = document.elementFromPoint(touch.clientX, touch.clientY);
        const wagon = over && over.closest("#drop-wagon");
        els.dropWagon.classList.remove("drag-over");
        touchClone.remove();
        touchClone = null;
        card.style.opacity = "";
        if (wagon && !state.locked) tryAnswer(date, card);
      });

      els.answers.appendChild(card);
    });
  }

  async function tryAnswer(date, card) {
    if (state.locked) return;
    state.locked = true;

    const correct = date === state.current.date;
    const cards = [...els.answers.querySelectorAll(".answer-card")];

    if (correct) {
      if (card && card.classList) card.classList.add("correct", "used");
      els.dropWagon.classList.add("filled");
      els.dropSlot.textContent = date;
      els.dropHint.hidden = true;
      els.feedback.textContent = "Так! Дата у вагончику — їдемо!";
      els.feedback.className = "feedback ok";
      if (window.GameAudio) window.GameAudio.playCorrect();
      state.score += 1;
      els.score.textContent = String(state.score);
      state.index += 1;

      await wait(350);
      await driveCaravanAway();
      nextQuestion();
    } else {
      if (card && card.classList) card.classList.add("wrong");
      els.feedback.textContent = `Ні… Правильна дата: ${state.current.date}`;
      els.feedback.className = "feedback bad";
      if (window.GameAudio) window.GameAudio.playWrong();
      state.lives -= 1;
      els.lives.textContent = String(state.lives);

      cards.forEach((c) => {
        if (c.dataset.date === state.current.date) c.classList.add("correct");
        c.classList.add("used");
      });

      els.dropWagon.classList.add("filled");
      els.dropSlot.textContent = state.current.date;
      els.dropHint.hidden = true;
      state.index += 1;

      await wait(1600);
      if (state.lives <= 0) endGame();
      else nextQuestion();
    }
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function endGame() {
    const total = state.queue.length;
    const score = state.score;
    const pct = total ? Math.round((score / total) * 100) : 0;

    if (state.lives <= 0 && score < total) {
      els.resultTitle.textContent = "Ой… життя закінчились";
      els.resultText.textContent = `Правильних: ${score} з ${total}. Круть чекає на нову спробу!`;
    } else if (pct === 100) {
      els.resultTitle.textContent = "Ура! Караван прибув!";
      els.resultText.textContent = `Ідеально! Усі ${total} дат у вагончиках. Ти зірка історії!`;
    } else if (pct >= 70) {
      els.resultTitle.textContent = "Гарна поїздка!";
      els.resultText.textContent = `Правильних: ${score} з ${total} (${pct}%). Ще трохи — і НМТ у кишені!`;
    } else {
      els.resultTitle.textContent = "Треба ще потренуватись";
      els.resultText.textContent = `Правильних: ${score} з ${total}. Поїдемо ще раз?`;
    }

    show("result");
  }

  els.dropWagon.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!state.locked) els.dropWagon.classList.add("drag-over");
  });
  els.dropWagon.addEventListener("dragleave", () => {
    els.dropWagon.classList.remove("drag-over");
  });
  els.dropWagon.addEventListener("drop", (e) => {
    e.preventDefault();
    els.dropWagon.classList.remove("drag-over");
    if (state.locked) return;
    const date = e.dataTransfer.getData("text/plain");
    const card = [...els.answers.querySelectorAll(".answer-card")].find(
      (c) => c.dataset.date === date
    );
    if (date) tryAnswer(date, card || { classList: { add() {} } });
  });

  els.btnStart.addEventListener("click", startGame);
  els.btnStartModal.addEventListener("click", () => {
    els.modal.hidden = true;
    startGame();
  });
  els.btnHow.addEventListener("click", () => {
    els.modal.hidden = false;
  });
  els.modalClose.addEventListener("click", () => {
    els.modal.hidden = true;
  });
  els.modal.addEventListener("click", (e) => {
    if (e.target === els.modal) els.modal.hidden = true;
  });
  els.btnHome.addEventListener("click", () => show("landing"));
  els.btnHomeResult.addEventListener("click", () => show("landing"));
  els.btnAgain.addEventListener("click", startGame);
  els.topicSelect.addEventListener("change", () => {
    if (!els.game.hidden) startGame();
  });

  const all = window.HISTORY_DATES || [];
  if (els.datesCount) els.datesCount.textContent = String(all.length);
  fillTopics();
  show("landing");
})();
