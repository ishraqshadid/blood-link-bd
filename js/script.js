const SUPABASE_URL = 'https://ahcoliliwwwovdfdpjew.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Szjwx8FpUT2-e-viMDIY6w_sWrXSHK7';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const publicVapidKey = 'BPT3FXeFUxI6ANp9DjHLzBVftJQzoComjKwSMPB2MGGWJ1nsQNZqND2RWpxQrZ6nUUyCjBdt_pP9bk8LaUNDw1A';

let isDark = localStorage.getItem('theme') === 'dark';
let menuOpen = false;
let hiddenAdminTapCount = 0;
let hiddenAdminTapTimer = null;

document.documentElement.lang = 'en';
document.documentElement.classList.toggle('dark', isDark);

function $(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function setHTML(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatRemaining(ms) {
  if (ms <= 0) return '0 days left';
  const totalHours = Math.ceil(ms / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''}${hours ? ` ${hours}h` : ''} left`;
  return `${hours} hour${hours > 1 ? 's' : ''} left`;
}

function isCooldownActive(profile) {
  if (!profile?.availability_locked || !profile?.cooldown_until) return false;
  return new Date(profile.cooldown_until).getTime() > Date.now();
}

function isBloodPostActive(row) {
  if (!row) return false;
  if (row.status === 'fulfilled') return false;
  const createdAt = row.created_at ? new Date(row.created_at).getTime() : Date.now();
  return Date.now() < createdAt + (4 * 24 * 60 * 60 * 1000);
}

function getBadgeHTML(count) {
  if (count >= 10) return `<span class="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full text-[10px] font-black border border-amber-200 dark:border-amber-800 uppercase tracking-wider shadow-sm"><i class="fa-solid fa-crown"></i> Legend Donor</span>`;
  if (count >= 5) return `<span class="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full text-[10px] font-black border border-amber-200 dark:border-amber-800 uppercase tracking-wider shadow-sm"><i class="fa-solid fa-award"></i> Hero Donor</span>`;
  if (count >= 3) return `<span class="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-[10px] font-black border border-slate-200 dark:border-slate-600 uppercase tracking-wider shadow-sm"><i class="fa-solid fa-medal"></i> Regular Donor</span>`;
  if (count >= 1) return `<span class="inline-flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-3 py-1 rounded-full text-[10px] font-black border border-orange-200 dark:border-orange-800 uppercase tracking-wider shadow-sm"><i class="fa-solid fa-certificate"></i> Rising Donor</span>`;
  return '';
}

function updateEnglishUi() {
  setText('menu-title', 'Menu');
  setText('nav-dev', 'Developer');
  setText('nav-leaderboard', 'Top Donors');
  setText('nav-feed', 'All Blood Posts');
  setText('nav-requests', 'My Blood Posts');
  setText('theme-text', isDark ? 'Light Theme' : 'Dark Theme');
  setHTML('hero-title', 'Your Blood Can <span class="text-brand">Save a Life</span>');
  setText('hero-sub', 'Find blood donors near you instantly. No login required.');
  setText('search-title', 'Find Donor');
  setText('select-bg', 'Select Blood Group');
  setText('loc-btn', 'Use Current Location');
  setText('search-btn', 'Search Donors');
  setHTML('donor-cta-title', '<i class="fa-solid fa-hand-holding-medical text-brand"></i> Become a Donor');
  setText('donor-cta-sub', 'Join us and save lives.');
  setText('donor-cta-btn', 'Join Now');
  setHTML('emergency-title', '<i class="fa-solid fa-truck-medical"></i> Emergency Need?');
  setText('emergency-sub', 'Post an urgent blood request');
  setText('btn-emergency', 'Post');

  const langButton = document.querySelector('[onclick="toggleLanguage()"]');
  if (langButton) langButton.style.display = 'none';
}

window.toggleLanguage = function () {
  return;
};

window.toggleMenu = function () {
  const menu = $('side-menu');
  const overlay = $('menu-overlay');
  if (!menu || !overlay) return;

  if (menu.classList.contains('-translate-x-full')) {
    menu.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.add('opacity-100'), 10);
    document.body.style.overflow = 'hidden';
    menuOpen = true;
  } else {
    menu.classList.add('-translate-x-full');
    overlay.classList.remove('opacity-100');
    setTimeout(() => overlay.classList.add('hidden'), 300);
    document.body.style.overflow = 'auto';
    menuOpen = false;
  }
};

window.toggleTheme = function () {
  isDark = !isDark;
  document.documentElement.classList.toggle('dark', isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateEnglishUi();
};

window.showDeveloper = function () {
  window.location.href = 'developer.html';
};

window.closeDeveloper = function () {};

window.loginWithGoogle = async function () {
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/index.html`,
      queryParams: { prompt: 'select_account' }
    }
  });

  if (error) alert(`Login failed: ${error.message}`);
};

window.handleLogin = async function (event) {
  event.preventDefault();
  const form = event.target;
  const emailInput = form.querySelector('input[type="email"]');
  const button = form.querySelector('button[type="submit"]');
  if (!emailInput) return;

  const original = button ? button.innerHTML : '';
  if (button) {
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
  }

  const { error } = await supabaseClient.auth.signInWithOtp({
    email: emailInput.value.trim(),
    options: { emailRedirectTo: `${window.location.origin}/index.html` }
  });

  if (error) {
    alert(`Login failed: ${error.message}`);
    if (button) {
      button.disabled = false;
      button.innerHTML = original || 'Send Magic Link';
    }
    return;
  }

  alert('Magic link sent. Please check your email.');
  if (button) button.innerHTML = '<i class="fa-solid fa-check"></i> Link Sent!';
};

window.handleLogout = async function () {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    alert(`Logout failed: ${error.message}`);
    return;
  }
  window.location.href = 'index.html';
};

supabaseClient.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_IN') checkAuthState();
  if (event === 'SIGNED_OUT') {
    if (
      window.location.pathname.includes('donor-profile.html') ||
      window.location.pathname.includes('emergency-post.html') ||
      window.location.pathname.includes('requester-dashboard.html')
    ) {
      window.location.href = 'index.html';
    }
  }
});

async function checkAuthState() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const guestCta = $('guest-cta-section');
  const donorFeed = $('donor-feed-section');
  const menuCard = $('menu-donor-card');
  const navProfileIcon = $('nav-profile-icon');
  const menuLogoutBtn = $('menu-logout-btn');

  if (session) {
    if (navProfileIcon) navProfileIcon.href = 'donor-profile.html';
    if (menuLogoutBtn) menuLogoutBtn.classList.remove('hidden');

    const { data: profile } = await supabaseClient
      .from('donors')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (profile && menuCard) {
      menuCard.classList.remove('hidden');
      setText('menu-user-name', profile.full_name || 'Donor');
      setText('menu-user-bg', profile.blood_group || '--');
      menuCard.onclick = () => {
        window.location.href = `public-profile.html?id=${profile.user_id}`;
      };
      menuCard.classList.add('cursor-pointer', 'transition', 'active:scale-95', 'hover:opacity-90');
    }

    document.querySelectorAll('a[href="login.html"]').forEach((link) => {
      link.href = 'donor-profile.html';
    });

    if (guestCta) guestCta.classList.add('hidden');
    if (donorFeed) {
      donorFeed.classList.remove('hidden');
      fetchUrgentRequests();
    }
    return;
  }

  if (navProfileIcon) navProfileIcon.href = 'login.html';
  if (menuLogoutBtn) menuLogoutBtn.classList.add('hidden');
  if (guestCta) guestCta.classList.remove('hidden');
  if (donorFeed) donorFeed.classList.add('hidden');
}

async function autoUnlockCooldown(userId, profile) {
  if (!profile?.availability_locked || !profile?.cooldown_until) return profile;
  const cooldownTime = new Date(profile.cooldown_until).getTime();
  if (Number.isNaN(cooldownTime) || cooldownTime > Date.now()) return profile;

  const payload = {
    is_available: true,
    availability_locked: false,
    cooldown_until: null,
    cooldown_reason: null
  };

  const { error } = await supabaseClient.from('donors').update(payload).eq('user_id', userId);
  if (error) return profile;
  return { ...profile, ...payload };
}

function renderCooldownBanner(profile) {
  const statusBanner = $('donor-status-banner');
  if (!statusBanner || !profile) return;

  const isComplete = !!(profile.full_name && profile.blood_group && profile.phone_number && profile.district && profile.upazila);
  const cooldownActive = isCooldownActive(profile);
  const isAvail = profile.is_available !== false && !cooldownActive;

  statusBanner.classList.remove('hidden');

  if (cooldownActive) {
    const remaining = formatRemaining(new Date(profile.cooldown_until).getTime() - Date.now());
    statusBanner.className = 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 p-3 rounded-xl text-center font-bold text-sm border border-amber-200 dark:border-amber-800 mb-4 block transition';
    statusBanner.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> Donation cooldown active until ${formatDateTime(profile.cooldown_until)}<div class="text-xs font-semibold mt-1">${profile.cooldown_reason || 'You donated recently.'} · ${remaining}</div>`;
    return;
  }

  if (isComplete && isAvail) {
    statusBanner.className = 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 p-3 rounded-xl text-center font-bold text-sm border border-green-200 dark:border-green-800 mb-4 block transition';
    statusBanner.innerHTML = '<i class="fa-solid fa-circle-check"></i> You are available for donation.';
    return;
  }

  statusBanner.className = 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 p-3 rounded-xl text-center font-bold text-sm border border-amber-200 dark:border-amber-800 mb-4 block transition';
  statusBanner.innerHTML = !isComplete
    ? '<i class="fa-solid fa-triangle-exclamation"></i> Profile incomplete. You are not listed as an active donor.'
    : '<i class="fa-solid fa-bell-slash"></i> Availability is currently turned off.';
}

function updateNotificationStatusUi(subscriptionExists = false) {
  const badge = $('notification-row-badge');
  const subtext = $('notification-subtext');
  if (badge) {
    badge.className = subscriptionExists
      ? 'inline-flex items-center px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-[11px] font-bold text-green-700 dark:text-green-300'
      : 'inline-flex items-center px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300';
    badge.textContent = subscriptionExists ? 'On' : 'Off';
  }
  if (subtext) {
    subtext.textContent = subscriptionExists
      ? 'Emergency alerts are enabled for this device.'
      : 'Turn on alerts for emergency requests in your area.';
  }
}

function createNotificationSheet() {
  if ($('notification-sheet-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'notification-sheet-overlay';
  overlay.className = 'fixed inset-0 bg-black/50 hidden items-end justify-center z-[70] backdrop-blur-sm p-4';
  overlay.innerHTML = `
    <div class="w-full max-w-md bg-white dark:bg-slate-800 rounded-[2rem] p-5 shadow-2xl border border-gray-100 dark:border-slate-700">
      <div class="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto mb-5"></div>
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 text-brand flex items-center justify-center border border-red-100 dark:border-red-900/30">
          <i class="fa-solid fa-bell"></i>
        </div>
        <div class="flex-1">
          <h3 class="text-lg font-black text-slate-800 dark:text-white">Enable Emergency Alerts</h3>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Get notified when urgent blood requests match your area.</p>
        </div>
      </div>
      <div class="mt-5 flex gap-3">
        <button type="button" onclick="closeNotificationSheet()" class="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-3.5 rounded-2xl font-bold">Not Now</button>
        <button id="enable-alerts-btn" type="button" onclick="enableAlertsFromSheet()" class="flex-1 bg-brand text-white py-3.5 rounded-2xl font-bold hover:bg-red-700 transition">Enable Alerts</button>
      </div>
    </div>
  `;
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeNotificationSheet();
  });
  document.body.appendChild(overlay);
}

window.openNotificationSheet = function () {
  createNotificationSheet();
  const overlay = $('notification-sheet-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
  }
};

window.closeNotificationSheet = function () {
  const overlay = $('notification-sheet-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
  }
};

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function ensureServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready || registration;
}

window.setupPushNotifications = async function () {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    alert('Please log in first.');
    return false;
  }

  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('This browser does not support notifications.');
    return false;
  }

  if (Notification.permission === 'denied') {
    alert('Notifications are blocked in this browser. Please allow notifications in site settings.');
    return false;
  }

  const registration = await ensureServiceWorker();
  if (!registration) {
    alert('Service worker registration failed.');
    return false;
  }

  const { data: donorRow } = await supabaseClient
    .from('donors')
    .select('push_subscription')
    .eq('user_id', session.user.id)
    .maybeSingle();

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription && !donorRow?.push_subscription) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Notification permission was not granted.');
      updateNotificationStatusUi(false);
      return false;
    }
  }

  subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
    });
  }

  const { error } = await supabaseClient
    .from('donors')
    .update({ push_subscription: subscription })
    .eq('user_id', session.user.id);

  if (error) {
    alert(`Notification setup failed: ${error.message}`);
    updateNotificationStatusUi(false);
    return false;
  }

  updateNotificationStatusUi(true);
  return true;
};

window.enableAlertsFromSheet = async function () {
  const btn = $('enable-alerts-btn');
  const original = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enabling...';
  }

  const ok = await window.setupPushNotifications();

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = original || 'Enable Alerts';
  }

  if (ok) {
    closeNotificationSheet();
    alert('Emergency alerts enabled.');
  }
};

async function syncNotificationStatusForCurrentUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    updateNotificationStatusUi(false);
    return;
  }

  const { data } = await supabaseClient
    .from('donors')
    .select('push_subscription')
    .eq('user_id', session.user.id)
    .maybeSingle();

  updateNotificationStatusUi(!!data?.push_subscription);
}

window.submitEmergencyPost = async function (event) {
  event.preventDefault();

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    alert('Please log in first.');
    window.location.href = 'login.html';
    return;
  }

  const btn = $('submit-post-btn') || event.target.querySelector('button[type="submit"]');
  const original = btn ? btn.innerHTML : '';

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Posting...';
  }

  const payload = {
    patient_name: $('patient_name')?.value?.trim() || '',
    blood_group: $('blood_group')?.value || '',
    units: parseInt($('units')?.value || '0', 10),
    hospital_name: $('hospital_name')?.value?.trim() || '',
    district: $('district')?.value || null,
    upazila: $('upazila')?.value || null,
    contact_number: $('contact_number')?.value?.trim() || '',
    urgency_level: $('urgency_level')?.value || 'normal',
    additional_note: $('additional_note')?.value?.trim() || null,
    user_id: session.user.id,
    status: 'open'
  };

  const { error } = await supabaseClient.from('blood_requests').insert([payload]);

  if (error) {
    alert(`Post failed: ${error.message}`);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = original || 'Post Request';
    }
    return;
  }

  alert('Your emergency request has been posted.');
  window.location.href = 'all-requests.html';
};

window.fetchUrgentRequests = async function () {
  const container = $('urgent-requests-container');
  if (!container) return;

  const { data: { session } } = await supabaseClient.auth.getSession();
  const currentUserId = session?.user?.id || null;

  let query = supabaseClient
    .from('blood_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (currentUserId) query = query.neq('user_id', currentUserId);

  const { data, error } = await query.limit(20);
  const rows = (data || []).filter(isBloodPostActive).slice(0, 3);

  if (error || rows.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-500 text-center py-8 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-gray-200 dark:border-slate-700 font-bold">No urgent requests right now.</p>';
    return;
  }

  container.innerHTML = rows.map((req) => `
    <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex justify-between items-center transition active:scale-95">
      <div class="min-w-0 pr-3">
        <div class="flex items-center gap-2 mb-1">
          <span class="bg-red-100 dark:bg-red-900/30 text-brand px-2 py-0.5 rounded text-[10px] font-black">${req.blood_group}</span>
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate"><i class="fa-solid fa-hospital"></i> ${req.hospital_name || 'Hospital'}</span>
        </div>
        <p class="font-bold text-sm text-slate-800 dark:text-white">${req.patient_name} <span class="text-[10px] font-normal text-slate-500">(${req.units} Bag)</span></p>
        <p class="text-[9px] text-slate-400 font-medium mt-0.5"><i class="fa-regular fa-clock"></i> ${formatDateTime(req.created_at)}</p>
      </div>
      <a href="tel:${req.contact_number}"
         onclick="return initiateEmergencyCall(event, '${String(req.contact_number || '').replace(/'/g, "\\'")}', '${String(req.user_id || '').replace(/'/g, "\\'")}', '${String(req.patient_name || '').replace(/'/g, "\\'")}', '${String(req.id || '').replace(/'/g, "\\'")}')"
         class="w-10 h-10 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-500 rounded-full flex items-center justify-center hover:bg-green-100 transition shadow-sm border border-green-100 dark:border-green-800/30">
        <i class="fa-solid fa-phone"></i>
      </a>
    </div>
  `).join('');
};

window.handleSearch = function () {
  const bg = $('blood-group-select')?.value;
  if (!bg) {
    alert('Please select a blood group first.');
    return;
  }
  window.location.href = `search-results.html?bg=${encodeURIComponent(bg)}`;
};

window.detectLocation = function () {
  const label = $('loc-btn');
  if (label) label.textContent = 'Detecting...';

  if (!navigator.geolocation) {
    if (label) label.textContent = 'Use Current Location';
    alert('Geolocation is not supported in this browser.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    () => {
      if (label) label.innerHTML = '<i class="fa-solid fa-check text-green-500"></i> Location detected';
    },
    () => {
      if (label) label.textContent = 'Use Current Location';
      alert('Please allow location access.');
    }
  );
};

async function getCurrentSessionAndProfile() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return { session: null, profile: null };

  const { data: profile } = await supabaseClient
    .from('donors')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();

  return { session, profile };
}

async function createPendingVerification(payload) {
  let query = supabaseClient
    .from('pending_verifications')
    .select('id,status,created_at')
    .eq('donor_id', payload.donor_id)
    .eq('requester_id', payload.requester_id)
    .eq('source', payload.source)
    .order('created_at', { ascending: false })
    .limit(1);

  if (payload.request_id) query = query.eq('request_id', payload.request_id);

  const { data } = await query;
  const latest = data?.[0];

  if (latest) {
    const latestAt = latest.created_at ? new Date(latest.created_at).getTime() : 0;
    const withinWindow = Date.now() - latestAt < 60 * 60 * 1000;
    if (withinWindow && ['pending', 'verified'].includes(latest.status)) {
      return { skipped: true };
    }
  }

  return supabaseClient.from('pending_verifications').insert([payload]);
}

window.initiateCallTracking = async function (event, phoneNumber, targetDonorId, targetName = '') {
  if (event?.preventDefault) event.preventDefault();

  const { session, profile } = await getCurrentSessionAndProfile();

  if (!session) {
    window.location.href = `tel:${phoneNumber}`;
    return false;
  }

  const { data: donorProfile } = await supabaseClient
    .from('donors')
    .select('user_id,full_name,is_available,availability_locked,cooldown_until')
    .eq('user_id', targetDonorId)
    .maybeSingle();

  const donorIsUnavailable = donorProfile
    ? donorProfile.is_available === false || isCooldownActive(donorProfile)
    : false;

  if (!donorIsUnavailable) {
    await createPendingVerification({
      donor_id: targetDonorId,
      requester_id: session.user.id,
      requester_name: profile?.full_name || session.user.email || 'Requester',
      donor_name: donorProfile?.full_name || targetName || 'Donor',
      donor_phone: phoneNumber || null,
      status: 'pending',
      source: 'donor_search',
      metadata: { created_from: 'donor_search' }
    });
  }

  window.location.href = `tel:${phoneNumber}`;
  return false;
};

window.initiateEmergencyCall = async function (event, phoneNumber, requesterId, patientName = '', requestId = null) {
  if (event?.preventDefault) event.preventDefault();

  const { session, profile } = await getCurrentSessionAndProfile();

  if (!session) {
    window.location.href = `tel:${phoneNumber}`;
    return false;
  }

  const donorUnavailable = !profile || profile.is_available === false || isCooldownActive(profile);

  if (!donorUnavailable) {
    await createPendingVerification({
      donor_id: session.user.id,
      requester_id: requesterId,
      requester_name: patientName || 'Requester',
      donor_name: profile.full_name || session.user.email || 'Donor',
      donor_phone: profile.phone_number || null,
      request_id: requestId || null,
      status: 'pending',
      source: 'emergency_post',
      metadata: { created_from: 'emergency_post' }
    });
  }

  window.location.href = `tel:${phoneNumber}`;
  return false;
};

async function applyVerifiedDonationToDonor(donorId) {
  const { data: donor, error } = await supabaseClient
    .from('donors')
    .select('*')
    .eq('user_id', donorId)
    .single();

  if (error || !donor) throw new Error(error?.message || 'Donor not found.');

  if (isCooldownActive(donor)) {
    throw new Error('This donor is already in cooldown.');
  }

  const today = new Date();
  const cooldownUntil = new Date(today.getTime() + (90 * 24 * 60 * 60 * 1000));

  const updatePayload = {
    total_donations: (donor.total_donations || 0) + 1,
    last_donation_date: today.toISOString().split('T')[0],
    is_available: false,
    availability_locked: true,
    cooldown_until: cooldownUntil.toISOString(),
    cooldown_reason: 'Donation verified. Cooldown is active for 90 days.'
  };

  const { error: updateError } = await supabaseClient
    .from('donors')
    .update(updatePayload)
    .eq('user_id', donorId);

  if (updateError) throw new Error(updateError.message);

  await supabaseClient.from('donation_events').insert([{
    donor_id: donorId,
    points: 100,
    source: 'verification',
    verified_at: new Date().toISOString()
  }]).catch(() => {});
}

async function getPendingVerificationForRequester() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return null;

  const { data } = await supabaseClient
    .from('pending_verifications')
    .select('*')
    .eq('requester_id', session.user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data || null;
}

function renderVerificationModal(row) {
  if (!row || $('fixed-noti-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'fixed-noti-overlay';
  overlay.className = 'fixed inset-0 bg-slate-900/95 z-[80] flex items-center justify-center p-6';
  overlay.innerHTML = `
    <div class="bg-white dark:bg-slate-800 p-8 rounded-3xl text-center max-w-xs w-full shadow-2xl">
      <h3 class="text-lg font-black mb-2 text-slate-800 dark:text-white">Did you receive blood?</h3>
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-6">Did you receive blood from <b>${row.donor_name || 'the donor'}</b>?</p>
      <button onclick="handleVerify('${row.id}', true)" class="w-full bg-brand text-white py-4 rounded-2xl font-black mb-3 transition hover:bg-red-700">Yes, I received it</button>
      <button onclick="handleVerify('${row.id}', false)" class="w-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 py-4 rounded-2xl font-bold transition hover:bg-slate-200 dark:hover:bg-slate-600">No, I did not</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

window.handleVerify = async function (id, verified) {
  const overlay = $('fixed-noti-overlay');
  if (overlay) overlay.style.opacity = '0.65';

  const { data: row, error } = await supabaseClient
    .from('pending_verifications')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !row) {
    if (overlay) overlay.remove();
    alert('Verification request not found.');
    return;
  }

  if (row.status !== 'pending') {
    if (overlay) overlay.remove();
    alert('This verification request was already processed.');
    return;
  }

  try {
    if (verified) {
      await applyVerifiedDonationToDonor(row.donor_id);
    }

    const { error: updateError } = await supabaseClient
      .from('pending_verifications')
      .update({
        status: verified ? 'verified' : 'rejected',
        responded_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('status', 'pending');

    if (updateError) throw new Error(updateError.message);

    if (overlay) overlay.remove();
    alert(verified ? 'Donation verified successfully.' : 'Marked as not received.');
    window.location.reload();
  } catch (err) {
    if (overlay) overlay.style.opacity = '1';
    alert(err.message || 'Verification failed.');
  }
};

async function handleVerificationFromQueryString() {
  const params = new URLSearchParams(window.location.search);
  const verifyStatus = params.get('verify');
  const verifyId = params.get('verifyId');
  if (!verifyStatus || !verifyId) return;

  if (verifyStatus !== 'verified' && verifyStatus !== 'rejected') return;

  const { data: row } = await supabaseClient
    .from('pending_verifications')
    .select('*')
    .eq('id', verifyId)
    .single();

  if (!row || row.status !== 'pending') {
    window.history.replaceState({}, document.title, window.location.pathname);
    return;
  }

  try {
    if (verifyStatus === 'verified') await applyVerifiedDonationToDonor(row.donor_id);

    await supabaseClient
      .from('pending_verifications')
      .update({
        status: verifyStatus,
        responded_at: new Date().toISOString()
      })
      .eq('id', verifyId)
      .eq('status', 'pending');

    alert(verifyStatus === 'verified' ? 'Donation verified successfully.' : 'Verification marked as rejected.');
  } catch (error) {
    alert(error.message || 'Verification failed.');
  } finally {
    window.history.replaceState({}, document.title, window.location.pathname);
    window.location.reload();
  }
}

window.recordNewDonation = async function () {
  if (!confirm('Did you donate blood today?')) return;

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    alert('Please log in first.');
    return;
  }

  const btn = $('record-donation-btn');
  const original = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
  }

  try {
    await applyVerifiedDonationToDonor(session.user.id);
    alert('Donation record updated.');
    window.location.reload();
  } catch (error) {
    alert(error.message || 'Failed to update donation.');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = original || '<i class="fa-solid fa-droplet"></i> I Donated Today';
    }
  }
};

function bindHiddenAdminTrigger() {
  const trigger = $('hidden-admin-trigger');
  if (!trigger) return;

  trigger.addEventListener('click', () => {
    hiddenAdminTapCount += 1;

    if (hiddenAdminTapTimer) clearTimeout(hiddenAdminTapTimer);
    hiddenAdminTapTimer = setTimeout(() => {
      hiddenAdminTapCount = 0;
    }, 1800);

    if (hiddenAdminTapCount >= 7) {
      hiddenAdminTapCount = 0;
      if (hiddenAdminTapTimer) clearTimeout(hiddenAdminTapTimer);
      window.location.href = 'admin-login.html';
    }
  });
}

async function loadEditProfileGeoOptions(currentProfileData) {
  const districtSelect = $('district');
  const upazilaSelect = $('upazila');
  if (!districtSelect || !upazilaSelect) return;

  try {
    const [districtRes, upazilaRes] = await Promise.all([
      fetch('https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/districts/districts.json'),
      fetch('https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/upazilas/upazilas.json')
    ]);

    const [districtJson, upazilaJson] = await Promise.all([districtRes.json(), upazilaRes.json()]);
    const districtRows = Array.isArray(districtJson) ? (districtJson.find((item) => Array.isArray(item?.data))?.data || []) : (districtJson?.data || []);
    const upazilaRows = Array.isArray(upazilaJson) ? (upazilaJson.find((item) => Array.isArray(item?.data))?.data || []) : (upazilaJson?.data || []);

    districtSelect.innerHTML = '<option value="" disabled selected>Select District</option>';
    districtRows.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((dist) => {
      districtSelect.add(new Option(dist.name, dist.name));
    });

    districtSelect.addEventListener('change', function () {
      upazilaSelect.innerHTML = '<option value="" disabled selected>Select Upazila</option>';
      upazilaSelect.disabled = true;

      const districtObj = districtRows.find((row) => row.name === this.value);
      if (!districtObj) return;

      upazilaRows
        .filter((row) => String(row.district_id) === String(districtObj.id))
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((row) => {
          upazilaSelect.add(new Option(row.name, row.name));
        });

      upazilaSelect.disabled = false;
    });

    if (currentProfileData?.district) {
      districtSelect.value = currentProfileData.district;
      districtSelect.dispatchEvent(new Event('change'));
      if (currentProfileData?.upazila) {
        setTimeout(() => {
          upazilaSelect.value = currentProfileData.upazila;
        }, 50);
      }
    }
  } catch (error) {
    console.error('Failed to load district/upazila data', error);
  }
}

async function bindAvatarUpload(userId) {
  const avatarInput = $('avatarUpload');
  if (!avatarInput || !userId) return () => null;

  let uploadedUrl = null;

  avatarInput.addEventListener('change', async function (event) {
    const file = event.target.files?.[0];
    const status = $('upload-status');
    if (!file) return;

    try {
      if (status) status.textContent = 'Optimizing image...';

      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const maxSize = 400;

      let width = bitmap.width;
      let height = bitmap.height;

      if (width > height && width > maxSize) {
        height *= maxSize / width;
        width = maxSize;
      } else if (height > maxSize) {
        width *= maxSize / height;
        height = maxSize;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(bitmap, 0, 0, width, height);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
      if (status) status.textContent = 'Uploading image...';

      const fileName = `public/${userId}-${Date.now()}.jpg`;
      const { error } = await supabaseClient.storage.from('avatars').upload(fileName, blob, { upsert: true });
      if (error) throw error;

      const { data } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
      uploadedUrl = data.publicUrl;

      const preview = $('edit-avatar-preview');
      if (preview) preview.src = uploadedUrl;
      if (status) status.textContent = 'Image ready to save.';
    } catch (error) {
      if (status) status.textContent = `Upload failed: ${error.message}`;
    }
  });

  return () => uploadedUrl;
}

document.addEventListener('DOMContentLoaded', async () => {
  updateEnglishUi();
  bindHiddenAdminTrigger();
  await checkAuthState();

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session && window.location.pathname.includes('login.html')) {
    window.location.href = 'donor-profile.html';
    return;
  }

  await handleVerificationFromQueryString();

  if ('serviceWorker' in navigator) {
    try { await ensureServiceWorker(); } catch (_) {}
  }

  syncNotificationStatusForCurrentUser();

  const user = session?.user || null;
  const donorForm = $('donorForm');
  const viewName = $('view-name');
  const availToggleBtn = $('isAvailable');

  let currentProfileData = null;
  let getUploadedAvatarUrl = () => null;

  if (user) {
    const { data: profile } = await supabaseClient
      .from('donors')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    currentProfileData = await autoUnlockCooldown(user.id, profile);

    if (currentProfileData) {
      renderCooldownBanner(currentProfileData);

      if (availToggleBtn) {
        availToggleBtn.checked = currentProfileData.is_available !== false && !isCooldownActive(currentProfileData);
      }

      const badgeContainer = $('view-badge-container');
      if (badgeContainer) badgeContainer.innerHTML = getBadgeHTML(currentProfileData.total_donations || 0);

      if (viewName) {
        viewName.innerHTML = `${currentProfileData.full_name || 'Donor'} <i class="fa-solid fa-circle-check text-blue-500 text-sm"></i>`;
        setText('view-bg', currentProfileData.blood_group || 'N/A');
        setText('view-phone', currentProfileData.phone_number || '-');
        setText('view-location', currentProfileData.district && currentProfileData.upazila ? `${currentProfileData.upazila}, ${currentProfileData.district}` : 'Location not set');
        setText('view-last-donation', currentProfileData.last_donation_date || '-');

        const avatarContainer = $('view-avatar-container');
        if (currentProfileData.avatar_url && avatarContainer) {
          avatarContainer.innerHTML = `<img src="${currentProfileData.avatar_url}" class="w-full h-full object-cover">`;
        }

        const shareBtn = $('share-my-profile-btn');
        if (shareBtn) {
          shareBtn.onclick = () => {
            const profileUrl = `${window.location.origin}/public-profile.html?id=${user.id}`;
            if (navigator.share && window.isSecureContext) {
              navigator.share({ title: 'Blood Donor Profile', text: 'I am a blood donor.', url: profileUrl }).catch(() => {});
            } else {
              prompt('Copy your profile link:', profileUrl);
            }
          };
        }
      }

      if (donorForm) {
        if ($('fullName')) $('fullName').value = currentProfileData.full_name || '';
        if ($('bloodGroup')) $('bloodGroup').value = currentProfileData.blood_group || '';
        if ($('phoneNumber')) $('phoneNumber').value = currentProfileData.phone_number || '';
        if ($('lastDonation')) $('lastDonation').value = currentProfileData.last_donation_date || '';
        if ($('bio')) $('bio').value = currentProfileData.bio || '';
        if ($('district')) $('district').value = currentProfileData.district || '';
        if ($('upazila')) $('upazila').value = currentProfileData.upazila || '';
        if ($('edit-avatar-preview') && currentProfileData.avatar_url) $('edit-avatar-preview').src = currentProfileData.avatar_url;
      }
    }
  }

  if ($('avatarUpload') && user) {
    getUploadedAvatarUrl = await bindAvatarUpload(user.id);
  }

  if (availToggleBtn) {
    availToggleBtn.addEventListener('change', async function () {
      if (!user) {
        alert('Please log in first.');
        this.checked = false;
        return;
      }

      if (isCooldownActive(currentProfileData)) {
        this.checked = false;
        alert(`You cannot turn availability on before ${formatDateTime(currentProfileData.cooldown_until)}.`);
        renderCooldownBanner(currentProfileData);
        return;
      }

      const nextValue = this.checked;
      const { error } = await supabaseClient.from('donors').update({ is_available: nextValue }).eq('user_id', user.id);
      if (error) {
        this.checked = !nextValue;
        alert(`Failed to update availability: ${error.message}`);
        return;
      }

      currentProfileData = { ...(currentProfileData || {}), is_available: nextValue };
      renderCooldownBanner(currentProfileData);
    });
  }

  if (donorForm) {
    await loadEditProfileGeoOptions(currentProfileData);

    donorForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!user) {
        alert('Please log in first.');
        return;
      }

      const btn = $('btn-save') || donorForm.querySelector('button[type="submit"]');
      const original = btn ? btn.innerHTML : '';

      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
      }

      const payload = {
        user_id: user.id,
        full_name: $('fullName')?.value?.trim() || null,
        blood_group: $('bloodGroup')?.value || null,
        district: $('district')?.value || null,
        upazila: $('upazila')?.value || null,
        phone_number: $('phoneNumber')?.value?.trim() || null,
        last_donation_date: $('lastDonation')?.value || currentProfileData?.last_donation_date || null,
        total_donations: currentProfileData?.total_donations || 0,
        bio: $('bio')?.value?.trim() || null,
        avatar_url: getUploadedAvatarUrl() || currentProfileData?.avatar_url || null,
        is_available: currentProfileData?.is_available ?? true,
        availability_locked: currentProfileData?.availability_locked ?? false,
        cooldown_until: currentProfileData?.cooldown_until || null,
        cooldown_reason: currentProfileData?.cooldown_reason || null
      };

      const { error } = await supabaseClient.from('donors').upsert(payload, { onConflict: 'user_id' });
      if (error) {
        alert(`Save failed: ${error.message}`);
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = original || 'Save';
        }
        return;
      }

      window.location.href = 'donor-profile.html';
    });
  }

  const pendingForRequester = await getPendingVerificationForRequester();
  if (pendingForRequester) renderVerificationModal(pendingForRequester);
});