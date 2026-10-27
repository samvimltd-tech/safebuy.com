/* SafeBuy NG: delivery partner onboarding + dashboard.
   Needs delivery.sql applied. Load after the inline Supabase script in index.html. */
(function () {
  "use strict";
  var c = window.safeBuySupabase;
  if (!c) return;

  var STATES = ["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"];
  var VEHICLES = [["bike","Motorbike"],["tricycle","Tricycle (keke)"],["car","Car"],["van","Van"],["bicycle","Bicycle"],["foot","On foot"]];

  var S = { partner: null, areas: [], coverage: [], riders: [], payouts: [], docs: [], offer: null, job: null };
  var tracking = false, lastPos = null, watchId = null, pingTimer = null, pollTimer = null, countTimer = null, wakeLock = null;
  var lastOfferId = null, lastJobKey = "";

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function naira(kobo) { return "₦" + (Number(kobo || 0) / 100).toLocaleString("en-NG"); }
  function toast(m) { if (window.showToast) window.showToast(m); }
  async function rpc(name, args) {
    var r = await c.rpc(name, args || {});
    if (r.error) throw r.error;
    return r.data;
  }
  function normPhone(v) {
    var d = String(v || "").replace(/\D/g, "");
    if (d.indexOf("234") === 0) d = d.slice(3);
    else if (d.charAt(0) === "0") d = d.slice(1);
    return d.length === 10 ? "+234" + d : "";
  }

  /* ---------- UI shell ---------- */
  var style = document.createElement("style");
  style.textContent =
    ".dp-card{padding:14px;margin:10px 0;border:1px solid var(--line);border-radius:14px;font-size:14px}" +
    ".dp-offer{border-color:var(--green);background:var(--green-light)}" +
    ".dp-count{font-size:22px;font-weight:800;color:var(--green-dark)}" +
    ".dp-row{display:flex;gap:8px;flex-wrap:wrap}.dp-row .button{width:auto;flex:1;margin:0}" +
    ".dp-areas{max-height:190px;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:6px 12px}" +
    ".dp-areas .check{text-transform:capitalize;margin:8px 0}" +
    ".dp-seg{display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
    ".dp-seg label{margin:0;padding:12px;border:1px solid var(--line);border-radius:12px;text-align:center;cursor:pointer}" +
    ".dp-seg input{display:none}.dp-seg input:checked+span{color:var(--green-dark);font-weight:800}";
  document.head.appendChild(style);

  var wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.id = "dp-backdrop";
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.setAttribute("aria-labelledby", "dp-title");
  wrap.innerHTML =
    '<div class="modal"><div class="modal-top"><h2 id="dp-title">Deliver with SafeBuy NG</h2>' +
    '<button class="icon-button" type="button" id="dp-close" aria-label="Close">✕</button></div>' +
    '<div id="dp-body"></div></div>';
  document.body.appendChild(wrap);
  var body = wrap.querySelector("#dp-body");

  function openModal() { wrap.classList.add("open"); }
  function closeModal() { wrap.classList.remove("open"); }
  wrap.querySelector("#dp-close").addEventListener("click", closeModal);
  wrap.addEventListener("click", function (e) { if (e.target === wrap) closeModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

  // Entry points: footer link + any element with data-action="deliver"
  var links = document.querySelector(".footer-links");
  if (links) {
    var a = document.createElement("a");
    a.href = "#deliver"; a.textContent = "Deliver with us";
    a.addEventListener("click", function (e) { e.preventDefault(); start(); });
    links.insertBefore(a, links.lastElementChild);
  }
  document.addEventListener("click", function (e) {
    if (e.target.closest('[data-action="deliver"]')) start();
  });

  function msg(text, bad) {
    var el = body.querySelector("#dp-msg");
    if (!el) return;
    el.textContent = text || "";
    el.style.color = bad ? "#8a1f1f" : "";
  }

  /* ---------- Loading ---------- */
  async function start() {
    var u = (await c.auth.getUser()).data.user;
    if (!u) {
      var acct = document.querySelector('[data-action="account"]');
      toast("Sign in or create an account to become a delivery partner.");
      if (acct) acct.click();
      return;
    }
    body.innerHTML = "<p>Loading…</p>";
    openModal();
    try { await load(u); render(); }
    catch (err) { body.innerHTML = "<p>" + esc(err.message || "Could not load delivery details.") + "</p>"; }
  }

  async function load(u) {
    var p = await c.from("delivery_partners").select("*").eq("user_id", u.id).maybeSingle();
    if (p.error) throw p.error;
    S.partner = p.data;
    S.coverage = await rpc("list_delivery_coverage");
    S.areas = []; S.riders = []; S.payouts = []; S.docs = [];
    if (!S.partner) return;
    var ar = await c.from("delivery_partner_areas").select("state,city").eq("partner_id", S.partner.id);
    S.areas = ar.data || [];
    var dd = await c.from("delivery_documents").select("doc_type,status,admin_note,created_at")
      .eq("partner_id", S.partner.id).order("created_at", { ascending: false });
    S.docs = dd.data || [];
    if (S.partner.status === "approved") {
      var po = await c.from("delivery_payouts").select("amount_kobo,status,created_at")
        .eq("payee_partner_id", S.partner.id).order("created_at", { ascending: false }).limit(10);
      S.payouts = po.data || [];
      if (S.partner.partner_type === "company") {
        var rd = await c.from("delivery_partners").select("full_name,status,is_online").eq("company_id", S.partner.id);
        S.riders = rd.data || [];
      }
    }
  }

  function render() {
    if (!S.partner) return renderRegister();
    var st = S.partner.status;
    if (st === "approved") return renderDashboard();
    document.getElementById("dp-title").textContent = S.partner.full_name;
    body.innerHTML =
      '<p class="status-pill' + (st === "pending" ? "" : " bad") + '">' + esc(st === "pending" ? "Under review" : st) + "</p>" +
      "<p>" + (st === "pending"
        ? "Thanks for applying. SafeBuy NG reviews every delivery partner before they can take jobs. We will check your details and get in touch on " + esc(S.partner.phone) + "."
        : "This delivery account is not active. Contact SafeBuy NG if you think this is a mistake.") + "</p>" +
      '<p class="form-message" id="dp-msg" role="status" aria-live="polite"></p>';
    if (st === "pending") renderDocs();
  }

  /* ---------- Verification documents ---------- */
  var DOC_LABEL = {
    id_card: "Government ID (NIN slip, driver's licence, voter's card or passport)",
    selfie: "Clear selfie of your face",
    vehicle_doc: "Vehicle papers or rider's licence (optional)",
    cac_certificate: "CAC certificate"
  };
  function docList() {
    return S.partner.partner_type === "company" ? ["cac_certificate", "id_card"] : ["id_card", "selfie", "vehicle_doc"];
  }
  function renderDocs() {
    var box = document.createElement("div");
    box.id = "dp-docs";
    box.innerHTML = "<h3>Verification documents</h3>" +
      '<p class="muted">Upload a photo or PDF (JPG, PNG, WebP or PDF, up to 5 MB). Only SafeBuy NG staff can open these files. We use them to confirm who you are and do not share them with buyers or sellers. By uploading you agree to this use.</p>' +
      docList().map(function (t) {
        var d = S.docs.filter(function (x) { return x.doc_type === t; })[0];
        var pill = !d ? '<span class="status-pill">Not uploaded</span>'
          : d.status === "approved" ? '<span class="status-pill ok">Approved</span>'
          : d.status === "rejected" ? '<span class="status-pill bad">Rejected</span>'
          : '<span class="status-pill">Under review</span>';
        return '<div class="dp-card"><strong>' + esc(DOC_LABEL[t]) + "</strong><br>" + pill +
          (d && d.status === "rejected" && d.admin_note ? '<p class="muted">Reason: ' + esc(d.admin_note) + "</p>" : "") +
          '<input type="file" data-doc="' + t + '" accept="image/jpeg,image/png,image/webp,application/pdf"' + (t === "selfie" ? ' capture="user"' : "") + "></div>";
      }).join("");
    body.appendChild(box);
    box.addEventListener("change", function (e) {
      var inp = e.target.closest("[data-doc]");
      if (inp && inp.files[0]) uploadDoc(inp.dataset.doc, inp.files[0], inp);
    });
  }
  async function uploadDoc(type, file, input) {
    var EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
    if (!EXT[file.type]) { msg("Use a JPG, PNG, WebP or PDF file.", true); input.value = ""; return; }
    if (file.size > 5 * 1024 * 1024) { msg("That file is larger than 5 MB.", true); input.value = ""; return; }
    input.disabled = true; msg("Uploading…");
    var u = (await c.auth.getUser()).data.user;
    var path = u.id + "/" + type + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8) + "." + EXT[file.type];
    var up = await c.storage.from("delivery-docs").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { msg("Upload failed: " + up.error.message, true); input.disabled = false; return; }
    try { await rpc("partner_add_document", { p_type: type, p_path: path }); }
    catch (err) {
      await c.storage.from("delivery-docs").remove([path]);
      msg(err.message, true); input.disabled = false; return;
    }
    await load(u); render(); msg("Uploaded. SafeBuy NG will review it.");
  }

  /* ---------- Registration ---------- */
  function areaBoxes(selected) {
    if (!S.coverage.length) {
      return '<p class="muted">SafeBuy NG delivery is not switched on in any area yet. Register now and add service areas here once your area opens.</p>';
    }
    return '<div class="dp-areas">' + S.coverage.map(function (a) {
      var key = a.state + "|" + a.city;
      var on = selected.some(function (s) { return s.state + "|" + s.city === key; });
      return '<label class="check"><input type="checkbox" class="dp-area" value="' + esc(key) + '"' + (on ? " checked" : "") + "> " +
        esc(a.city ? a.city + ", " + a.state : "All of " + a.state) + "</label>";
    }).join("") + "</div>";
  }
  function readAreas() {
    return Array.prototype.map.call(body.querySelectorAll(".dp-area:checked"), function (b) {
      var p = b.value.split("|"); return { state: p[0], city: p[1] };
    });
  }

  function renderRegister() {
    document.getElementById("dp-title").textContent = "Become a delivery partner";
    body.innerHTML =
      "<p>We are launching delivery city by city with verified partners, not everywhere at once. Applications are reviewed before you can take jobs.</p>" +
      '<form id="dp-form">' +
      '<div class="dp-seg"><label><input type="radio" name="dp-type" value="individual" checked><span>Individual rider</span></label>' +
      '<label><input type="radio" name="dp-type" value="company"><span>Delivery company</span></label></div>' +
      '<label for="dp-name">Your full name</label><input id="dp-name" required maxlength="100" autocomplete="name">' +
      '<div id="dp-co" hidden><label for="dp-coname">Company name</label><input id="dp-coname" maxlength="120">' +
      '<label for="dp-reg">CAC registration number</label><input id="dp-reg" maxlength="40"></div>' +
      '<label for="dp-phone">Phone / WhatsApp</label><input id="dp-phone" type="tel" required placeholder="08012345678">' +
      '<label for="dp-state">Home state</label><select id="dp-state">' +
      STATES.map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("") + "</select>" +
      '<div id="dp-ind"><label for="dp-veh">Vehicle</label><select id="dp-veh">' +
      VEHICLES.map(function (v) { return '<option value="' + v[0] + '">' + v[1] + "</option>"; }).join("") + "</select>" +
      '<label for="dp-code">Company code (optional, if you ride for a company)</label><input id="dp-code" maxlength="12" style="text-transform:uppercase">' +
      '<label>Where will you deliver?</label>' + areaBoxes([]) + "</div>" +
      '<label class="check"><input id="dp-agree" type="checkbox" required> I confirm my details are true and I agree to be verified (ID check) before taking jobs.</label>' +
      '<button class="button button-primary" type="submit" id="dp-submit">Apply</button></form>' +
      '<p class="form-message" id="dp-msg" role="status" aria-live="polite"></p>';

    var typeRadios = body.querySelectorAll('input[name="dp-type"]');
    Array.prototype.forEach.call(typeRadios, function (r) {
      r.addEventListener("change", function () {
        var co = body.querySelector('input[name="dp-type"]:checked').value === "company";
        body.querySelector("#dp-co").hidden = !co;
        body.querySelector("#dp-ind").hidden = co;
        body.querySelector("#dp-coname").required = co;
      });
    });

    body.querySelector("#dp-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var phone = normPhone(body.querySelector("#dp-phone").value);
      if (!phone) { msg("Enter a valid Nigerian number, for example 08012345678.", true); return; }
      var type = body.querySelector('input[name="dp-type"]:checked').value;
      var btn = body.querySelector("#dp-submit"); btn.disabled = true; msg("Submitting…");
      try {
        await rpc("partner_register", {
          p_type: type,
          p_full_name: body.querySelector("#dp-name").value,
          p_company_name: type === "company" ? body.querySelector("#dp-coname").value : null,
          p_company_reg: type === "company" ? body.querySelector("#dp-reg").value : null,
          p_phone: phone,
          p_state: body.querySelector("#dp-state").value,
          p_vehicle: type === "individual" ? body.querySelector("#dp-veh").value : null,
          p_company_code: type === "individual" ? body.querySelector("#dp-code").value : null,
          p_areas: type === "individual" ? readAreas() : []
        });
        toast("Application received. We will review it.");
        await start();
      } catch (err) {
        msg(/duplicate|unique/i.test(err.message) ? "You have already applied with this account." : err.message, true);
        btn.disabled = false;
      }
    });
  }

  /* ---------- Dashboard (approved partners) ---------- */
  function renderDashboard() {
    var p = S.partner, isCo = p.partner_type === "company";
    document.getElementById("dp-title").textContent = isCo ? (p.company_name || p.full_name) : p.full_name;
    var online = p.is_online && tracking;

    var html = '<p class="status-pill ok">✓ Approved partner</p>';

    if (isCo) {
      html +=
        '<div class="dp-card"><strong>Your company code: ' + esc(p.invite_code) + "</strong>" +
        '<p class="muted">Riders enter this code when they apply. SafeBuy NG still verifies each rider.</p></div>' +
        "<h3>Your riders</h3>" +
        (S.riders.length ? S.riders.map(function (r) {
          return '<div class="seller-row"><span>' + esc(r.full_name) + '</span><span class="muted">' + esc(r.status) + (r.is_online ? " · online" : "") + "</span></div>";
        }).join("") : '<p class="muted">No riders have joined yet.</p>') +
        "<h3>Earnings</h3>" + payoutsHtml();
      body.innerHTML = html + '<p class="form-message" id="dp-msg"></p>';
      return;
    }

    html +=
      '<div id="dp-offer"></div><div id="dp-job"></div>' +
      '<div class="dp-card"><strong>' + (online ? "You are online" : "You are offline") + "</strong>" +
      '<p class="muted">Keep this page open while online. Your location is shared only while you are online, so jobs can go to the nearest rider. Going offline stops it.</p>' +
      (online
        ? '<button class="button button-outline" type="button" id="dp-off">Go offline</button>'
        : '<label class="check"><input type="checkbox" id="dp-consent"' + (p.location_consent ? " checked" : "") + '> I agree to share my live location while I am online.</label>' +
          '<button class="button button-primary" type="button" id="dp-on">' + (p.is_online ? "Resume sharing location" : "Go online") + "</button>") +
      "</div>" +
      "<h3>Service areas</h3>" + areaBoxes(S.areas) +
      '<button class="button button-light" type="button" id="dp-save-areas">Save areas</button>' +
      "<h3>Earnings</h3>" + payoutsHtml() +
      '<p class="form-message" id="dp-msg" role="status" aria-live="polite"></p>';
    body.innerHTML = html;
    lastOfferId = null; lastJobKey = "";
    drawOffer(); drawJob();

    var on = body.querySelector("#dp-on"), off = body.querySelector("#dp-off");
    if (on) on.addEventListener("click", goOnline);
    if (off) off.addEventListener("click", goOffline);
    body.querySelector("#dp-save-areas").addEventListener("click", async function () {
      try { await rpc("partner_set_areas", { p_areas: readAreas() }); S.areas = readAreas(); msg("Areas saved."); }
      catch (err) { msg(err.message, true); }
    });
  }

  function payoutsHtml() {
    if (!S.payouts.length) return '<p class="muted">Completed deliveries will appear here. SafeBuy NG collects the delivery fee and pays you.</p>';
    return S.payouts.map(function (x) {
      return '<div class="seller-row"><span>' + naira(x.amount_kobo) + '</span><span class="muted">' + (x.status === "paid" ? "Paid" : "Pending payout") + "</span></div>";
    }).join("");
  }

  /* ---------- Online / location ---------- */
  function sendPing() {
    if (!lastPos) return;
    rpc("partner_ping", { p_lat: lastPos.latitude, p_lng: lastPos.longitude }).catch(function () {});
  }

  async function goOnline() {
    var consent = body.querySelector("#dp-consent");
    if (!consent || !consent.checked) { msg("Please agree to location sharing to go online.", true); return; }
    if (!navigator.geolocation) { msg("This device does not support location.", true); return; }
    msg("Getting your location…");
    navigator.geolocation.getCurrentPosition(async function (pos) {
      lastPos = pos.coords;
      try {
        await rpc("partner_set_online", { p_online: true, p_consent: true });
        S.partner.is_online = true; S.partner.location_consent = true;
        await rpc("partner_ping", { p_lat: lastPos.latitude, p_lng: lastPos.longitude });
        startTracking();
        render();
        toast("You are online.");
      } catch (err) { msg(err.message, true); }
    }, function () { msg("We could not get your location. Allow location access and try again.", true); },
    { enableHighAccuracy: true, timeout: 15000 });
  }

  function startTracking() {
    tracking = true;
    watchId = navigator.geolocation.watchPosition(function (p) { lastPos = p.coords; }, function () {}, { enableHighAccuracy: true });
    pingTimer = setInterval(sendPing, 20000);
    pollTimer = setInterval(poll, 8000);
    if (navigator.wakeLock) navigator.wakeLock.request("screen").then(function (l) { wakeLock = l; }).catch(function () {});
  }

  async function goOffline() {
    try { await rpc("partner_set_online", { p_online: false, p_consent: true }); } catch (e) {}
    stopTracking();
    S.partner.is_online = false;
    render();
  }
  function stopTracking() {
    tracking = false;
    if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
    clearInterval(pingTimer); clearInterval(pollTimer); clearInterval(countTimer);
    watchId = null;
    if (wakeLock) { wakeLock.release().catch(function () {}); wakeLock = null; }
  }

  /* ---------- Offers and active job ---------- */
  async function poll() {
    try {
      var o = await rpc("my_current_offer");
      var j = await rpc("my_active_job");
      S.offer = o && o.length ? o[0] : null;
      S.job = j && j.length ? j[0] : null;
      if (S.offer && S.offer.job_id !== lastOfferId && !wrap.classList.contains("open")) {
        toast("New delivery offer. Open Deliver with us to respond.");
        openModal();
      }
      drawOffer(); drawJob();
    } catch (e) { /* transient network errors are fine; next poll retries */ }
  }

  function drawOffer() {
    var box = body.querySelector("#dp-offer");
    if (!box) return;
    clearInterval(countTimer);
    var o = S.offer;
    if (!o) { box.innerHTML = ""; lastOfferId = null; return; }
    lastOfferId = o.job_id;
    box.innerHTML =
      '<div class="dp-card dp-offer"><strong>New delivery offer</strong>' +
      "<p>" + esc(o.pickup_city) + " → " + esc(o.dropoff_city) + (o.distance_km != null ? " · " + esc(o.distance_km) + " km to pickup" : "") +
      "<br>You earn <strong>" + naira(o.earnings_kobo) + '</strong></p><div class="dp-count" id="dp-count"></div>' +
      '<div class="dp-row"><button class="button button-primary" type="button" id="dp-acc">Accept</button>' +
      '<button class="button button-outline" type="button" id="dp-dec">Decline</button></div></div>';
    function tick() {
      var left = Math.max(0, Math.round((new Date(o.expires_at) - Date.now()) / 1000));
      var el = body.querySelector("#dp-count");
      if (el) el.textContent = left + "s to respond";
      if (left <= 0) { clearInterval(countTimer); S.offer = null; drawOffer(); }
    }
    tick(); countTimer = setInterval(tick, 1000);
    async function answer(accept) {
      body.querySelector("#dp-acc").disabled = true; body.querySelector("#dp-dec").disabled = true;
      try {
        var r = await rpc("partner_respond_offer", { p_job: o.job_id, p_accept: accept });
        if (r === "expired") toast("That offer is no longer available.");
        else if (r === "accepted") toast("Job accepted.");
      } catch (err) { toast(err.message); }
      S.offer = null; await poll();
    }
    body.querySelector("#dp-acc").addEventListener("click", function () { answer(true); });
    body.querySelector("#dp-dec").addEventListener("click", function () { answer(false); });
  }

  function drawJob() {
    var box = body.querySelector("#dp-job");
    if (!box) return;
    var j = S.job;
    var key = j ? j.job_id + j.status : "";
    if (key === lastJobKey) return;       // do not wipe the code field while the partner is typing
    lastJobKey = key;
    if (!j) { box.innerHTML = ""; return; }
    box.innerHTML =
      '<div class="dp-card"><strong>' + (j.status === "assigned" ? "Go to pickup" : "Deliver to buyer") + "</strong>" +
      "<p><strong>Pickup:</strong> " + esc(j.pickup_address) + ", " + esc(j.pickup_city) +
      (j.pickup_phone ? ' · <a href="tel:' + esc(j.pickup_phone) + '">' + esc(j.pickup_phone) + "</a>" : "") +
      "<br><strong>Drop-off:</strong> " + esc(j.dropoff_address) + ", " + esc(j.dropoff_city) +
      (j.dropoff_name ? "<br>" + esc(j.dropoff_name) : "") +
      (j.dropoff_phone ? ' · <a href="tel:' + esc(j.dropoff_phone) + '">' + esc(j.dropoff_phone) + "</a>" : "") +
      "<br>You earn <strong>" + naira(j.earnings_kobo) + "</strong></p>" +
      (j.status === "assigned"
        ? '<div class="dp-row"><button class="button button-primary" type="button" id="dp-picked">Picked up</button>' +
          '<button class="button button-outline" type="button" id="dp-release">Give back job</button></div>'
        : '<label for="dp-dcode">Buyer\'s 4-digit delivery code</label><input id="dp-dcode" inputmode="numeric" maxlength="4">' +
          '<button class="button button-primary" type="button" id="dp-done">Mark delivered</button>') +
      "</div>";

    async function run(fn) { try { await fn(); } catch (err) { toast(err.message); } await poll(); }
    var pk = box.querySelector("#dp-picked"), rl = box.querySelector("#dp-release"), dn = box.querySelector("#dp-done");
    if (pk) pk.addEventListener("click", function () { run(function () { return rpc("partner_update_job", { p_job: j.job_id, p_status: "picked_up" }); }); });
    if (rl) rl.addEventListener("click", function () {
      if (confirm("Give this job back? It will be offered to another rider.")) run(function () { return rpc("partner_release_job", { p_job: j.job_id }); });
    });
    if (dn) dn.addEventListener("click", function () {
      run(async function () {
        var r = await rpc("partner_update_job", { p_job: j.job_id, p_status: "delivered", p_code: box.querySelector("#dp-dcode").value.trim() });
        if (r === "wrong_code") toast("That code is not correct.");
        else if (r === "locked") toast("Too many wrong codes. Contact SafeBuy NG.");
        else { toast("Delivered. Thank you!"); S.payouts = []; var u = (await c.auth.getUser()).data.user; await load(u); renderDashboard(); }
      });
    });
  }

  // If the partner reloads the page, the server may still say "online" but we are no longer sharing location.
  window.addEventListener("pagehide", function () {
    if (tracking && S.partner) { try { c.rpc("partner_set_online", { p_online: false, p_consent: true }); } catch (e) {} }
  });
})();
