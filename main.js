// Clay Tan / Index. Two small behaviours: tracking box and reticle cursor.
(() => {
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

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

  /* ---------- reticle cursor: mouse only, off for reduced motion ---------- */

  if (!finePointer || reduce) return;

  root.classList.add("has-cursor");
  const cur = document.createElement("div");
  cur.className = "cur";
  cur.setAttribute("aria-hidden", "true");
  cur.innerHTML = '<div class="cur-ticks"><i></i><i></i><i></i><i></i></div><div class="cur-ring"></div><div class="cur-lbl"></div>';
  document.body.append(cur);
  const [ticks, ring, lbl] = cur.children;

  const SNAP = 10;
  let segs = { h: [], v: [] };
  let mx = 0, my = 0, frame = 0;

  // Snap targets in page coordinates: the hairlines
  function collect() {
    const sx = scrollX, sy = scrollY;
    segs = { h: [], v: [] };
    document.querySelectorAll(".ln-h").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width) segs.h.push({ p: r.top + sy, a: r.left + sx, b: r.right + sx });
    });
    document.querySelectorAll(".ln-v").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height) segs.v.push({ p: r.left + sx, a: r.top + sy, b: r.bottom + sy });
    });
  }

  function nearest(list, along, across) {
    let best = SNAP, hit = null;
    for (const s of list) {
      if (across < s.a - SNAP || across > s.b + SNAP) continue;
      const d = Math.abs(along - s.p);
      if (d < best) { best = d; hit = s.p; }
    }
    return hit;
  }

  const pad = (n) => String(Math.max(0, Math.round(n))).padStart(4, "0");

  function render() {
    frame = 0;
    const px = mx + scrollX, py = my + scrollY;
    const lx = nearest(segs.v, px, py);
    const ly = nearest(segs.h, py, px);
    // The reticle stays on the real pointer so clicks land where they look; on a lock only
    // the ring steps onto the line, at most SNAP px, and that axis's ticks go full ink
    ticks.style.transform = `translate(${mx}px, ${my}px)`;
    ring.style.transform = `translate(${lx === null ? mx : lx - scrollX}px, ${ly === null ? my : ly - scrollY}px)`;
    ticks.classList.toggle("lock-x", lx !== null);
    ticks.classList.toggle("lock-y", ly !== null);
    lbl.textContent = lx !== null || ly !== null
      ? `LOCK ${lx !== null ? "X" : ""}${ly !== null ? "Y" : ""} ${pad(px)} / ${pad(py)}`
      : `X ${pad(px)} / Y ${pad(py)}`;
    // Label sits below right of the ring, and flips to the other side near the right or
    // bottom edge so it never runs off the page or over the row below
    const w = lbl.offsetWidth, hgt = lbl.offsetHeight;
    const left = mx + 24 + w > innerWidth ? mx - 24 - w : mx + 24;
    const top = my + 24 + hgt > innerHeight - 24 ? my - 24 - hgt : my + 24;
    lbl.style.transform = `translate(${left}px, ${top}px)`;
  }

  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    mx = e.clientX;
    my = e.clientY;
    cur.classList.add("on");
    if (!frame) frame = requestAnimationFrame(render);
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => cur.classList.remove("on"));

  collect();
  // Re-measure once the draw-in has finished and fonts have settled
  setTimeout(collect, 800);
  document.fonts?.ready.then(collect);
  addEventListener("resize", collect);
  addEventListener("scroll", () => { if (!frame) frame = requestAnimationFrame(render); }, { passive: true });
})();
