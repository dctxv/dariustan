// Clay Tan / Index. The tracking box, the edition stamp and the day or night print.
(() => {
  const root = document.documentElement;

  /* ---------- the edition stamp in the footer ---------- */

  const stamp = document.querySelector(".stamp");
  const stampTime = document.querySelector(".stamp-time");
  let sky = window.melbourne();

  // Try each wording, longest first, until it fits its cell on one line: the filler goes before the stamp
  function fit(line, el, variants) {
    for (const v of variants) {
      el.textContent = v;
      if (line.scrollWidth <= line.clientWidth) return;
    }
  }

  function renderStamp() {
    const eyes = (root.dataset.eyes || "").toUpperCase();
    const no = root.dataset.print, of = root.dataset.prints;
    if (stamp && no && eyes) {
      fit(stamp, stamp.firstChild, [`Print ${no} / ${of} · ${eyes}`, `${no} / ${of} · ${eyes}`, eyes]);
    }
    if (stampTime) {
      const t = sky.time, p = sky.night ? "Night" : "Day";
      fit(stampTime, stampTime, [`Melbourne ${t} · ${p} print · © 2026`, `Melbourne ${t} · ${p} · © 2026`,
        `Mel ${t} · ${p} · © 2026`, `Mel ${t} · ${p}`]);
    }
  }
  document.addEventListener("edition", renderStamp);
  addEventListener("resize", renderStamp);

  // The swatch reprints: a fresh draw, so any forced ?col= goes
  document.querySelector(".swatch")?.addEventListener("click", () => {
    const url = new URL(location.href);
    url.searchParams.delete("col");
    location.assign(url);
  });

  /* ---------- night or day in Melbourne, asked again every minute ---------- */

  const themeColour = document.querySelector('meta[name="theme-color"]');
  function checkSky() {
    sky = window.melbourne();
    const time = sky.night ? "night" : "day";
    if (root.dataset.time !== time) {
      root.dataset.time = time;
      document.dispatchEvent(new Event("printchange"));
    }
    themeColour.content = getComputedStyle(root).getPropertyValue("--paper").trim();
    renderStamp();
  }
  checkSky();
  setTimeout(() => { checkSky(); setInterval(checkSky, 60000); }, 60000 - (Date.now() % 60000));

  /* ---------- tracking box: hover (mouse) or keyboard focus ---------- */

  const box = document.createElement("div");
  box.className = "track";
  box.setAttribute("aria-hidden", "true");
  box.innerHTML = '<span class="track-lbl"></span><i></i><i></i><i></i><i></i>';
  document.body.append(box);
  const boxLbl = box.firstChild;
  let target = null;

  function placeBox() {
    if (!target) return;
    const r = target.getBoundingClientRect();
    const p = 4;
    box.style.transform = `translate(${r.left - p}px, ${r.top - p}px)`;
    box.style.width = `${r.width + p * 2}px`;
    box.style.height = `${r.height + p * 2}px`;
  }

  function show(el) {
    if (el === target) return;
    if (!el) return hide();
    const wasHidden = !target;
    target = el;
    boxLbl.textContent = el.dataset.target;
    // Appear in place instead of flying in from the last spot
    if (wasHidden) box.classList.add("jump");
    placeBox();
    box.classList.add("on");
    if (wasHidden) requestAnimationFrame(() => box.classList.remove("jump"));
  }

  function hide() {
    target = null;
    box.classList.remove("on");
  }

  document.addEventListener("pointerover", (e) => {
    if (e.pointerType === "touch") return;
    show(e.target.closest("[data-target]"));
  });
  document.documentElement.addEventListener("pointerleave", hide);
  document.addEventListener("focusin", (e) => {
    if (e.target.matches(":focus-visible")) show(e.target.closest("[data-target]"));
  });
  document.addEventListener("focusout", hide);
  addEventListener("scroll", placeBox, { passive: true });
  addEventListener("resize", placeBox);
})();
