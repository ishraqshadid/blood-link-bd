// ==========================================
// 1. SUPABASE CONFIGURATION
// ==========================================
const SUPABASE_URL = 'https://ahcoliliwwwovdfdpjew.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Szjwx8FpUT2-e-viMDIY6w_sWrXSHK7';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 2. THEME, LANGUAGE, GEO & COMMON HELPERS
// ==========================================
let currentLang = 'en';
localStorage.setItem('lang', 'en');
let isDark = localStorage.getItem('theme') === 'dark';
let menuOpen = false;
let geoCachePromise = null;
let pendingRealtimeChannel = null;

if (isDark) document.documentElement.classList.add('dark');
else document.documentElement.classList.remove('dark');
document.documentElement.lang = 'en';

const dict = {
    en: {
        menuTitle: 'Menu',
        navDev: 'Developer',
        themeText: 'Dark Theme',
        navLeaderboard: 'Top Donors',
        heroTitle: 'Your Blood Can <span class="text-brand">Save a Life</span>',
        heroSub: 'Find blood donors near you instantly. No login required.',
        searchTitle: 'Find Donor',
        selectBg: 'Select Blood Group',
        locBtn: 'Use Current Location',
        searchBtn: 'Search Donors',
        donorCtaTitle: '<i class="fa-solid fa-hand-holding-medical text-brand"></i> Become a Donor',
        donorCtaSub: 'Join us and save lives.',
        donorCtaBtn: 'Join Now',
        emergencyTitle: '<i class="fa-solid fa-truck-medical"></i> Emergency Need?',
        emergencySub: 'Post an urgent blood request',
        btnEmergency: 'Post',
        navFeed: 'Blood Feed',
        navMyPost: 'My Blood Post'
    }
};

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}
function setHTML(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = value;
}
function escapeHtml(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
function escapeJsString(value = '') {
    return String(value)
        .replaceAll('\\', '\\\\')
        .replaceAll("'", "\\'")
        .replaceAll('\n', '\\n')
        .replaceAll('\r', '');
}
function normalizeText(value = '') {
    return String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\u0980-\u09ff ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function extractGeoArray(json) {
    if (Array.isArray(json)) {
        const found = json.find(item => item && Array.isArray(item.data));
        if (found) return found.data;
    }
    if (json && Array.isArray(json.data)) return json.data;
    return [];
}
async function getGeoData() {
    if (!geoCachePromise) {
        geoCachePromise = Promise.all([
            fetch('https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/districts/districts.json').then(r => r.json()),
            fetch('https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/upazilas/upazilas.json').then(r => r.json())
        ]).then(([districtsJson, upazilasJson]) => ({
            districts: extractGeoArray(districtsJson),
            upazilas: extractGeoArray(upazilasJson)
        })).catch(err => {
            console.error('Geo load error:', err);
            return { districts: [], upazilas: [] };
        });
    }
    return geoCachePromise;
}
function inferLocationFromText(text, districts = [], upazilas = []) {
    const normalized = normalizeText(text);
    if (!normalized) return { district: '', upazila: '' };

    let matchedUpazila = upazilas.find(item => normalized.includes(normalizeText(item.name)));
    let matchedDistrict = districts.find(item => normalized.includes(normalizeText(item.name)));

    if (!matchedDistrict && matchedUpazila) {
        matchedDistrict = districts.find(item => String(item.id) === String(matchedUpazila.district_id));
    }

    return {
        district: matchedDistrict?.name || '',
        upazila: matchedUpazila?.name || ''
    };
}
async function initLinkedLocationSelects({
    districtId,
    upazilaId,
    defaultDistrict = '',
    defaultUpazila = '',
    districtPlaceholder = 'Select District',
    upazilaPlaceholder = 'Select Upazila'
}) {
    const districtSelect = document.getElementById(districtId);
    const upazilaSelect = document.getElementById(upazilaId);
    if (!districtSelect || !upazilaSelect) return;

    const { districts, upazilas } = await getGeoData();

    districtSelect.innerHTML = `<option value="" disabled ${defaultDistrict ? '' : 'selected'}>${districtPlaceholder}</option>`;
    districts
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(district => districtSelect.add(new Option(district.name, district.name)));

    function renderUpazilas(districtName, selectedUpazila = '') {
        upazilaSelect.innerHTML = `<option value="" disabled ${selectedUpazila ? '' : 'selected'}>${upazilaPlaceholder}</option>`;
        upazilaSelect.disabled = true;
        if (!districtName) return;

        const districtObj = districts.find(item => item.name === districtName);
        if (!districtObj) return;

        upazilas
            .filter(item => String(item.district_id) === String(districtObj.id))
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(item => upazilaSelect.add(new Option(item.name, item.name)));

        if (selectedUpazila) upazilaSelect.value = selectedUpazila;
        upazilaSelect.disabled = false;
    }

    districtSelect.onchange = () => renderUpazilas(districtSelect.value);

    if (defaultDistrict) {
        districtSelect.value = defaultDistrict;
        renderUpazilas(defaultDistrict, defaultUpazila);
    }
}


const BLOOD_POST_VISIBLE_DAYS = 4;

function getBloodPostCutoffISOString(days = BLOOD_POST_VISIBLE_DAYS) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function isBloodPostActive(row) {
    const createdAt = row?.created_at ? new Date(row.created_at).getTime() : 0;
    if (!createdAt || Number.isNaN(createdAt)) return true;
    return createdAt >= (Date.now() - BLOOD_POST_VISIBLE_DAYS * 24 * 60 * 60 * 1000);
}

function isEmergencyUrgency(value = '') {
    const normalized = String(value).toLowerCase().trim();
    if (!normalized) return false;
    return normalized !== 'normal / regular' && normalized !== 'normal' && normalized !== 'regular';
}

function shouldNotifyDistrictDonors(requestRow) {
    const units = Number(requestRow?.units || 0);
    return units > 2 && isEmergencyUrgency(requestRow?.urgency_level) && Boolean(requestRow?.district);
}

async function triggerDistrictEmergencyAlert(requestRow) {
    if (!requestRow || !shouldNotifyDistrictDonors(requestRow)) return;

    try {
        const { data, error } = await supabaseClient.functions.invoke('send-verification-push', {
            body: {
                action: 'district_request_alert',
                request: {
                    id: requestRow.id,
                    patient_name: requestRow.patient_name,
                    blood_group: requestRow.blood_group,
                    units: requestRow.units,
                    district: requestRow.district,
                    upazila: requestRow.upazila,
                    hospital_name: requestRow.hospital_name,
                    urgency_level: requestRow.urgency_level,
                    requester_id: requestRow.user_id,
                    created_at: requestRow.created_at || new Date().toISOString()
                }
            }
        });

        if (error) {
            console.error('District emergency alert invoke error:', error);
            return;
        }

        console.log('District emergency alert sent:', data);
    } catch (err) {
        console.error('District emergency alert failed:', err);
    }
}

function updateText() {
    const t = dict[currentLang];
    setText('menu-title', t.menuTitle);
    setText('nav-dev', t.navDev);
    setText('nav-leaderboard', t.navLeaderboard);
    setText('theme-text', isDark ? 'Light Theme' : t.themeText);
    setHTML('hero-title', t.heroTitle);
    setText('hero-sub', t.heroSub);
    setText('search-title', t.searchTitle);
    setText('select-bg', t.selectBg);
    setText('search-btn', t.searchBtn);
    setHTML('donor-cta-title', t.donorCtaTitle);
    setText('donor-cta-sub', t.donorCtaSub);
    setText('donor-cta-btn', t.donorCtaBtn);
    setHTML('emergency-title', t.emergencyTitle);
    setText('emergency-sub', t.emergencySub);
    setText('btn-emergency', t.btnEmergency);
}

window.toggleMenu = function () {
    const menu = document.getElementById('side-menu');
    const overlay = document.getElementById('menu-overlay');
    const body = document.body;
    if (!menu || !overlay) return;

    if (menu.classList.contains('-translate-x-full')) {
        menu.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.add('opacity-100'), 10);
        body.style.overflow = 'hidden';
        menuOpen = true;
    } else {
        menu.classList.add('-translate-x-full');
        overlay.classList.remove('opacity-100');
        setTimeout(() => overlay.classList.add('hidden'), 300);
        body.style.overflow = 'auto';
        menuOpen = false;
    }
};

window.toggleTheme = function () {
    isDark = !isDark;
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateText();
};

window.toggleLanguage = function () { return; };

window.getBadgeHTML = function (count) {
    if (count >= 5) return `<span class="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full text-[10px] font-black border border-amber-200 dark:border-amber-800 uppercase tracking-wider shadow-sm"><i class="fa-solid fa-award"></i> Super Hero</span>`;
    if (count >= 3) return `<span class="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-[10px] font-black border border-slate-200 dark:border-slate-600 uppercase tracking-wider shadow-sm"><i class="fa-solid fa-medal"></i> Regular Donor</span>`;
    if (count >= 1) return `<span class="inline-flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-3 py-1 rounded-full text-[10px] font-black border border-orange-200 dark:border-orange-800 uppercase tracking-wider shadow-sm"><i class="fa-solid fa-certificate"></i> New Donor</span>`;
    return '';
};

// ==========================================
// 3. AUTHENTICATION
// ==========================================
window.loginWithGoogle = async function () {
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/index.html',
            queryParams: { prompt: 'select_account' }
        }
    });
    if (error) alert('Error: ' + error.message);
};

window.handleLogin = async function (event) {
    event.preventDefault();
    const emailInput = event.target.querySelector('input[type="email"]');
    const btn = event.target.querySelector('button[type="submit"]');
    if (!emailInput || !btn) return;

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
    btn.disabled = true;

    const { error } = await supabaseClient.auth.signInWithOtp({
        email: emailInput.value,
        options: { emailRedirectTo: window.location.origin + '/index.html' }
    });

    if (error) {
        alert('Error: ' + error.message);
        btn.innerHTML = 'Send Magic Link';
        btn.disabled = false;
        return;
    }

    alert('Success! Check your email for the magic link.');
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Link Sent!';
};

window.handleLogout = async function () {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        alert('Logout Error: ' + error.message);
    } else {
        window.location.href = 'index.html';
    }
};

function isCooldownLocked(profile) {
    if (!profile?.availability_locked || !profile?.cooldown_until) return false;
    const untilTs = new Date(profile.cooldown_until).getTime();
    return Number.isFinite(untilTs) && untilTs > Date.now();
}

function formatCooldownDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
}

function getRemainingCooldownParts(value) {
    if (!value) return null;
    const diff = new Date(value).getTime() - Date.now();
    if (diff <= 0 || Number.isNaN(diff)) return { days: 0, hours: 0, text: 'Ended' };
    const totalHours = Math.ceil(diff / 3600000);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const text = `${days} day(s) ${hours} hour(s) left`;
    return { days, hours, text };
}

async function normalizeOwnAvailabilityLock(userId, profile) {
    if (!profile) return null;
    if (!profile.availability_locked || !profile.cooldown_until) return profile;

    const untilTs = new Date(profile.cooldown_until).getTime();
    if (!Number.isFinite(untilTs)) return profile;
    if (untilTs > Date.now()) return profile;

    const updated = {
        ...profile,
        is_available: true,
        availability_locked: false,
        cooldown_until: null,
        cooldown_reason: null
    };

    const { error } = await supabaseClient
        .from('donors')
        .update({
            is_available: true,
            availability_locked: false,
            cooldown_until: null,
            cooldown_reason: null
        })
        .eq('user_id', userId);

    if (error) {
        console.error('Cooldown auto unlock failed:', error);
        return profile;
    }

    return updated;
}

async function getSessionAndProfile() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return { session: null, profile: null };

    const { data: profile } = await supabaseClient
        .from('donors')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

    const normalizedProfile = await normalizeOwnAvailabilityLock(session.user.id, profile || null);
    return { session, profile: normalizedProfile || null };
}

supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') {
        checkAuthState();
        if (window.location.pathname.includes('login.html')) window.location.href = 'donor-profile.html';
        setTimeout(() => setupPushNotifications(), 1500);
    } else if (event === 'SIGNED_OUT') {
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
    const { session, profile } = await getSessionAndProfile();
    const guestCta = document.getElementById('guest-cta-section');
    const donorFeed = document.getElementById('donor-feed-section');
    const menuCard = document.getElementById('menu-donor-card');
    const menuLogoutBtn = document.getElementById('menu-logout-btn');

    if (session) {
        if (menuLogoutBtn) menuLogoutBtn.classList.remove('hidden');
        if (profile && menuCard) {
            menuCard.classList.remove('hidden');
            setText('menu-user-name', profile.full_name || 'Donor');
            setText('menu-user-bg', profile.blood_group || '--');
            menuCard.onclick = () => window.location.href = `public-profile.html?id=${profile.user_id}`;
            menuCard.classList.add('cursor-pointer', 'transition', 'active:scale-95', 'hover:opacity-90');
        }
        document.querySelectorAll('a[href="login.html"]').forEach(btn => btn.href = 'donor-profile.html');
        if (guestCta) guestCta.classList.add('hidden');
        if (donorFeed) {
            donorFeed.classList.remove('hidden');
            fetchUrgentRequests();
        }
        subscribePendingVerifications();
    } else {
        if (menuLogoutBtn) menuLogoutBtn.classList.add('hidden');
        if (guestCta) guestCta.classList.remove('hidden');
        if (donorFeed) donorFeed.classList.add('hidden');
    }
}

// ==========================================
// 4. SEARCH, POSTS, LOCATION
// ==========================================
window.submitEmergencyPost = async function (event) {
    event.preventDefault();
    const { session } = await getSessionAndProfile();

    if (!session) {
        alert('Please log in first!');
        window.location.href = 'login.html';
        return;
    }

    const btn = document.getElementById('submit-post-btn');
    const originalText = btn ? btn.innerHTML : 'Post Request';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Posting...';
        btn.disabled = true;
    }

    const district = document.getElementById('request-district')?.value || '';
    const upazila = document.getElementById('request-upazila')?.value || '';

    const payload = {
        patient_name: document.getElementById('patient_name')?.value?.trim(),
        blood_group: document.getElementById('blood_group')?.value,
        units: parseInt(document.getElementById('units')?.value || '0', 10),
        hospital_name: document.getElementById('hospital_name')?.value?.trim(),
        contact_number: document.getElementById('contact_number')?.value?.trim(),
        urgency_level: document.getElementById('urgency_level')?.value,
        district,
        upazila,
        user_id: session.user.id
    };

    const { data: insertedRequest, error } = await supabaseClient
        .from('blood_requests')
        .insert([payload])
        .select('*')
        .single();

    if (error) {
        alert('Error: ' + error.message);
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
        return;
    }

    await triggerDistrictEmergencyAlert(insertedRequest);

    alert('Your emergency request was posted successfully!');
    window.location.href = 'all-requests.html';
};

window.fetchUrgentRequests = async function () {
    const container = document.getElementById('urgent-requests-container');
    if (!container) return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    const currentUserId = session?.user?.id || null;

    let query = supabaseClient
        .from('blood_requests')
        .select('*')
        .gte('created_at', getBloodPostCutoffISOString())
        .order('created_at', { ascending: false });

    if (currentUserId) query = query.neq('user_id', currentUserId);

    const { data, error } = await query.limit(3);

    const activeData = (data || []).filter(isBloodPostActive);

    if (error || activeData.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-8 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-gray-200 dark:border-slate-700 font-bold">No urgent requests right now.</p>';
        return;
    }

    let html = '';
    for (const req of activeData) {
        const postDate = req.created_at
            ? new Date(req.created_at).toLocaleString('en-US', {
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            })
            : '';

        const locationText = [req.upazila, req.district].filter(Boolean).join(', ');
        html += `
<div class="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex justify-between items-center gap-3 transition active:scale-95">
    <div class="min-w-0">
        <div class="flex items-center gap-2 mb-1 flex-wrap">
            <span class="bg-red-100 dark:bg-red-900/30 text-brand px-2 py-0.5 rounded text-[10px] font-black">${escapeHtml(req.blood_group || '--')}</span>
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter"><i class="fa-solid fa-hospital"></i> ${escapeHtml(req.hospital_name || 'Hospital')}</span>
        </div>
        <p class="font-bold text-sm text-slate-800 dark:text-white truncate">${escapeHtml(req.patient_name || 'Unknown Patient')} <span class="text-[10px] font-normal text-slate-500">(${escapeHtml(req.units || 0)} Bag)</span></p>
        ${locationText ? `<p class="text-[10px] text-slate-400 truncate mt-0.5"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(locationText)}</p>` : ''}
        <p class="text-[9px] text-slate-400 font-medium mt-0.5"><i class="fa-regular fa-clock"></i> ${escapeHtml(postDate)}</p>
    </div>
    <a href="tel:${escapeHtml(req.contact_number || '')}"
       onclick="callRequesterFromPost(event, '${escapeJsString(req.contact_number || '')}', '${escapeJsString(req.user_id || '')}', '${escapeJsString(req.id || '')}', '${escapeJsString(req.patient_name || '')}')"
       class="w-10 h-10 shrink-0 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-500 rounded-full flex items-center justify-center hover:bg-green-100 transition shadow-sm border border-green-100 dark:border-green-800/30">
        <i class="fa-solid fa-phone"></i>
    </a>
</div>`;
    }
    container.innerHTML = html;
};

window.handleSearch = function () {
    const bg = document.getElementById('blood-group-select')?.value;
    if (!bg) {
        alert('Please select a blood group first.');
        return;
    }
    window.location.href = `search-results.html?bg=${encodeURIComponent(bg)}`;
};

window.detectLocation = function () {
    const locBtn = document.getElementById('loc-btn');
    if (locBtn) locBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';

    if (!navigator.geolocation) {
        if (locBtn) locBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs text-brand"></i>';
        return;
    }

    navigator.geolocation.getCurrentPosition(
        () => {
            if (locBtn) {
                locBtn.innerHTML = `<i class="fa-solid fa-check text-green-500"></i> Location Detected!`;
            }
        },
        () => {
            if (locBtn) locBtn.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-amber-500"></i>`;
            alert('Please allow location access.');
        }
    );
};

window.showDeveloper = function () {
    window.location.href = 'developer.html';
};
window.closeDeveloper = function () {
    const modal = document.getElementById('dev-modal');
    if (modal) modal.classList.add('hidden');
};

// ==========================================
// 5. RECORD DONATION BUTTON
// ==========================================
window.recordNewDonation = async function () {
    if (!confirm('Did you donate blood today? Please confirm.')) return;

    const { session } = await getSessionAndProfile();
    if (!session) {
        alert('Please login first!');
        return;
    }

    const btn = document.getElementById('record-donation-btn');
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
        btn.disabled = true;
    }

    try {
        const { data: profile, error: fetchErr } = await supabaseClient
            .from('donors')
            .select('total_donations')
            .eq('user_id', session.user.id)
            .maybeSingle();

        if (fetchErr) throw fetchErr;

        const currentTotal = profile?.total_donations || 0;
        const today = new Date().toISOString().split('T')[0];

        const cooldownUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
        const { error: updateErr } = await supabaseClient
            .from('donors')
            .update({
                total_donations: currentTotal + 1,
                last_donation_date: today,
                is_available: false,
                availability_locked: true,
                cooldown_until: cooldownUntil,
                cooldown_reason: `You donated blood on ${today}. Cooldown active for 3 months.`
            })
            .eq('user_id', session.user.id);

        if (updateErr) throw updateErr;

        alert('Thank you! Donation count updated.');
        window.location.reload();
    } catch (error) {
        alert('Error: ' + error.message);
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-droplet"></i> I Donated Today';
            btn.disabled = false;
        }
    }
};

// ==========================================
// 6. PROFILE PAGES & FORM INIT
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    updateText();
    await registerServiceWorker();
    await checkAuthState();
    listenForServiceWorkerMessages();
    await processVerificationFromURL();

    const { session, profile } = await getSessionAndProfile();
    const user = session?.user || null;

    let currentProfileData = profile;
    let newUploadedAvatarUrl = null;

    const donorForm = document.getElementById('donorForm');
    const viewName = document.getElementById('view-name');
    const availToggleBtn = document.getElementById('isAvailable');
    const statusBanner = document.getElementById('donor-status-banner');

    function updateStatusBanner() {
        if (!statusBanner) return;

        statusBanner.classList.remove('hidden');
        const isComplete = currentProfileData &&
            currentProfileData.full_name &&
            currentProfileData.blood_group &&
            currentProfileData.phone_number &&
            currentProfileData.district &&
            currentProfileData.upazila;

        const cooldownActive = isCooldownLocked(currentProfileData);
        const isAvail = currentProfileData && currentProfileData.is_available !== false;

        if (availToggleBtn) {
            availToggleBtn.disabled = cooldownActive;
            availToggleBtn.checked = cooldownActive ? false : isAvail;
        }

        if (cooldownActive) {
            const remaining = getRemainingCooldownParts(currentProfileData.cooldown_until);
            const reason = currentProfileData.cooldown_reason || 'You donated blood recently. Donor availability is temporarily locked.';
            statusBanner.className = 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 p-4 rounded-xl text-left font-bold text-sm border border-blue-200 dark:border-blue-800 mb-4 block transition';
            statusBanner.innerHTML = `
                <div class="flex items-start gap-2">
                    <i class="fa-solid fa-hourglass-half mt-0.5"></i>
                    <div class="space-y-1">
                        <div>Donation cooldown is active</div>
                        <div class="text-xs font-medium opacity-90">${escapeHtml(reason)}</div>
                        <div class="text-xs font-medium opacity-90">Available again: ${escapeHtml(formatCooldownDateTime(currentProfileData.cooldown_until))}</div>
                        <div class="text-xs font-medium opacity-90">${escapeHtml(remaining?.text || '')}</div>
                    </div>
                </div>`;
            return;
        }

        if (isComplete && isAvail) {
            statusBanner.className = 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 p-3 rounded-xl text-center font-bold text-sm border border-green-200 dark:border-green-800 mb-4 block transition';
            statusBanner.innerHTML = '<i class="fa-solid fa-circle-check"></i> You are now an Active Donor!';
        } else {
            statusBanner.className = 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 p-3 rounded-xl text-center font-bold text-sm border border-amber-200 dark:border-amber-800 mb-4 block transition';
            statusBanner.innerHTML = !isComplete
                ? '<i class="fa-solid fa-triangle-exclamation"></i> Profile incomplete. You are not a donor.'
                : '<i class="fa-solid fa-bell-slash"></i> Availability OFF. You are not a donor.';
        }
    }

    if (availToggleBtn) {
        availToggleBtn.addEventListener('change', async function () {
            if (!user) {
                alert('Please log in first!');
                this.checked = false;
                return;
            }

            if (isCooldownLocked(currentProfileData)) {
                this.checked = false;
                updateStatusBanner();
                alert(`Availability cannot be turned on now. Try again after ${formatCooldownDateTime(currentProfileData.cooldown_until)}.`);
                return;
            }

            const isAvail = this.checked;
            const { error } = await supabaseClient
                .from('donors')
                .update({ is_available: isAvail })
                .eq('user_id', user.id);

            if (error) {
                this.checked = !isAvail;
                alert('Failed to update status.');
                return;
            }

            if (!currentProfileData) currentProfileData = {};
            currentProfileData.is_available = isAvail;
            updateStatusBanner();
        });
    }

    if (currentProfileData) {
        if (availToggleBtn) availToggleBtn.checked = currentProfileData.is_available !== false;
        updateStatusBanner();

        const badgeContainer = document.getElementById('view-badge-container');
        if (badgeContainer) badgeContainer.innerHTML = getBadgeHTML(currentProfileData.total_donations || 0);

        if (viewName && document.getElementById('view-phone')) {
            viewName.innerHTML = `${escapeHtml(currentProfileData.full_name || 'Donor')} <i class="fa-solid fa-circle-check text-blue-500 text-sm"></i>`;
            setText('view-bg', currentProfileData.blood_group || 'N/A');
            setText('view-phone', currentProfileData.phone_number || '-');
            setText('view-location', (currentProfileData.district && currentProfileData.upazila) ? `${currentProfileData.upazila}, ${currentProfileData.district}` : 'Location not set');
            setText('view-last-donation', currentProfileData.last_donation_date || '-');

            if (currentProfileData.avatar_url && document.getElementById('view-avatar-container')) {
                document.getElementById('view-avatar-container').innerHTML = `<img src="${escapeHtml(currentProfileData.avatar_url)}" class="w-full h-full object-cover">`;
            }

            const shareBtn = document.getElementById('share-my-profile-btn');
            if (shareBtn && user) {
                shareBtn.onclick = () => {
                    const profileUrl = window.location.origin + '/public-profile.html?id=' + user.id;
                    if (navigator.share && window.isSecureContext) {
                        navigator.share({ title: 'Blood Donor Profile', text: 'I am a blood donor!', url: profileUrl }).catch(console.error);
                    } else {
                        prompt('Copy your profile link:', profileUrl);
                    }
                };
            }
        }

        if (donorForm) {
            const fullName = document.getElementById('fullName');
            const bloodGroup = document.getElementById('bloodGroup');
            const phoneNumber = document.getElementById('phoneNumber');
            const lastDonation = document.getElementById('lastDonation');
            const bio = document.getElementById('bio');
            const avatarPreview = document.getElementById('edit-avatar-preview');

            if (fullName) fullName.value = currentProfileData.full_name || '';
            if (bloodGroup) bloodGroup.value = currentProfileData.blood_group || '';
            if (phoneNumber) phoneNumber.value = currentProfileData.phone_number || '';
            if (lastDonation) lastDonation.value = currentProfileData.last_donation_date || '';
            if (bio) bio.value = currentProfileData.bio || '';
            if (avatarPreview && currentProfileData.avatar_url) avatarPreview.src = currentProfileData.avatar_url;
        }
    } else if (viewName && statusBanner) {
        updateStatusBanner();
    }

    await initLinkedLocationSelects({
        districtId: 'district',
        upazilaId: 'upazila',
        defaultDistrict: currentProfileData?.district || '',
        defaultUpazila: currentProfileData?.upazila || ''
    });

    await initLinkedLocationSelects({
        districtId: 'request-district',
        upazilaId: 'request-upazila'
    });

    const avatarInput = document.getElementById('avatarUpload');
    if (avatarInput) {
        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file || !user) return;

            const statusText = document.getElementById('upload-status');
            if (statusText) statusText.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-brand"></i> Optimizing...';

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = function (event) {
                const img = new Image();
                img.src = event.target.result;
                img.onload = async function () {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const MAX_SIZE = 400;

                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(async (blob) => {
                        if (!blob) return;
                        if (statusText) statusText.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-brand"></i> Uploading...';

                        const fileName = `public/${user.id}-${Date.now()}.jpg`;
                        const { error } = await supabaseClient.storage
                            .from('avatars')
                            .upload(fileName, blob, { upsert: true });

                        if (error) {
                            if (statusText) statusText.innerHTML = `<span class="text-red-500 font-bold text-xs">Failed: ${escapeHtml(error.message)}</span>`;
                            return;
                        }

                        const { data } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
                        newUploadedAvatarUrl = data.publicUrl;
                        const preview = document.getElementById('edit-avatar-preview');
                        if (preview) preview.src = data.publicUrl;
                        if (statusText) statusText.innerHTML = '<span class="text-green-500 font-bold text-xs">Ready to save!</span>';
                    }, 'image/jpeg', 0.8);
                };
            };
        });
    }

    if (donorForm) {
        donorForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btn = document.getElementById('btn-save');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
            }

            if (!user) {
                alert('Please log in first!');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = 'Save & Return';
                }
                return;
            }

            const payload = {
                user_id: user.id,
                full_name: document.getElementById('fullName')?.value?.trim() || null,
                blood_group: document.getElementById('bloodGroup')?.value || null,
                district: document.getElementById('district')?.value || null,
                upazila: document.getElementById('upazila')?.value || null,
                phone_number: document.getElementById('phoneNumber')?.value?.trim() || null,
                last_donation_date: document.getElementById('lastDonation')?.value || currentProfileData?.last_donation_date || null,
                total_donations: currentProfileData?.total_donations || 0,
                bio: document.getElementById('bio')?.value || null,
                avatar_url: newUploadedAvatarUrl || currentProfileData?.avatar_url || null,
                is_available: currentProfileData?.is_available ?? true,
                availability_locked: currentProfileData?.availability_locked ?? false,
                cooldown_until: currentProfileData?.cooldown_until || null,
                cooldown_reason: currentProfileData?.cooldown_reason || null
            };

            const { error } = await supabaseClient
                .from('donors')
                .upsert(payload, { onConflict: 'user_id' });

            if (error) {
                alert('Error: ' + error.message);
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = 'Save & Return';
                }
                return;
            }

            window.location.href = 'donor-profile.html';
        });
    }

    setTimeout(() => setupPushNotifications(), 2000);
    setTimeout(() => checkPendingVerifications(), 1200);
});


function getActiveDonorLockInfo(profile) {
    if (!profile?.availability_locked || !profile?.cooldown_until) {
        return { active: false, daysRemaining: 0, profile: profile || null };
    }
    const parts = getRemainingCooldownParts(profile.cooldown_until);
    return {
        active: isCooldownLocked(profile),
        daysRemaining: parts?.days || 0,
        profile: profile || null,
        until: profile.cooldown_until,
        reason: profile.cooldown_reason || ''
    };
}

function showCooldownAlert(profileOrDate) {
    const untilText = formatCooldownDateTime(profileOrDate?.cooldown_until || profileOrDate || '');
    const msg = `This donor is in cooldown now. They will be available again after ${untilText}.`;
    alert(msg);
}

// ==========================================
// 7. TWO-WAY VERIFICATION FLOW
// ==========================================

async function insertPendingVerification(row) {
    try {
        const cleanRow = {
            donor_id: row.donor_id || null,
            requester_id: row.requester_id || null,
            donor_name: row.donor_name || null,
            requester_name: row.requester_name || null,
            donor_phone: row.donor_phone || null,
            request_id: row.request_id || null,
            source: row.source || 'call',
            status: 'pending',
            metadata: row.metadata || {}
        };

        if (!cleanRow.donor_id || !cleanRow.requester_id || cleanRow.donor_id === cleanRow.requester_id) {
            return { ok: false, reason: 'invalid' };
        }

        let duplicateQuery = supabaseClient
            .from('pending_verifications')
            .select('*')
            .eq('donor_id', cleanRow.donor_id)
            .eq('requester_id', cleanRow.requester_id)
            .eq('source', cleanRow.source)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1);

        duplicateQuery = cleanRow.request_id
            ? duplicateQuery.eq('request_id', cleanRow.request_id)
            : duplicateQuery.is('request_id', null);

        const { data: existingPending, error: duplicateError } = await duplicateQuery.maybeSingle();
        if (duplicateError) {
            console.error('Verification duplicate check error:', duplicateError);
        }
        if (existingPending) {
            return { ok: true, duplicate: true, data: existingPending };
        }

        const { data, error } = await supabaseClient
            .from('pending_verifications')
            .insert([cleanRow])
            .select('*')
            .single();

        if (error) {
            console.error('Verification insert error:', error);
            return { ok: false, reason: 'insert_error', error };
        }

        return { ok: true, duplicate: false, data };
    } catch (err) {
        console.error('Verification insert exception:', err);
        return { ok: false, reason: 'exception', error: err };
    }
}


window.callDonorForDonation = async function (event, phoneNumber, donorId, donorName) {
    if (event) event.preventDefault();

    try {
        const { session, profile } = await getSessionAndProfile();

        if (session && donorId && session.user.id !== donorId) {
            const { data: targetDonor, error: donorError } = await supabaseClient
                .from('donors')
                .select('user_id, availability_locked, cooldown_until, cooldown_reason, is_available')
                .eq('user_id', donorId)
                .maybeSingle();
            if (donorError) throw donorError;

            if (isCooldownLocked(targetDonor) || targetDonor?.is_available === false) {
                showCooldownAlert(targetDonor);
                return;
            }

            await insertPendingVerification({
                donor_id: donorId,
                requester_id: session.user.id,
                donor_name: donorName || null,
                requester_name: profile?.full_name || session.user.email || 'Requester',
                donor_phone: phoneNumber || null,
                source: 'donor_search',
                metadata: { phone_number: phoneNumber || null }
            });
        }
    } catch (err) {
        console.error('callDonorForDonation error:', err);
    }

    window.location.href = `tel:${phoneNumber}`;
};

window.initiateCallTracking = window.callDonorForDonation;


window.callRequesterFromPost = async function (event, phoneNumber, requesterId, requestId, patientName) {
    if (event) event.preventDefault();

    try {
        const { session, profile } = await getSessionAndProfile();

        if (session && requesterId && session.user.id !== requesterId) {
            await insertPendingVerification({
                donor_id: session.user.id,
                requester_id: requesterId,
                donor_name: profile?.full_name || session.user.email || 'Donor',
                requester_name: patientName || 'Requester',
                donor_phone: profile?.phone_number || null,
                request_id: requestId ? Number(requestId) : null,
                source: 'emergency_post',
                metadata: { phone_number: phoneNumber || null }
            });
        }
    } catch (err) {
        console.error('callRequesterFromPost error:', err);
    }

    window.location.href = `tel:${phoneNumber}`;
};

async function checkPendingVerifications() {
    const { session } = await getSessionAndProfile();
    if (!session) return;

    const { data: pending, error } = await supabaseClient
        .from('pending_verifications')
        .select('*')
        .eq('requester_id', session.user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Pending verification read error:', error);
        return;
    }

    if (pending) showVerificationModal(pending);
}

function showVerificationModal(data) {
    if (!data || document.getElementById('fixed-noti-overlay')) return;

    const donorText = escapeHtml(data.donor_name || 'a donor');
    const div = document.createElement('div');
    div.id = 'fixed-noti-overlay';
    div.className = 'fixed inset-0 bg-slate-900/95 z-[9999] flex items-center justify-center p-6';
    div.innerHTML = `
        <div class="bg-white dark:bg-slate-800 p-6 rounded-3xl text-center max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-700">
            <h3 class="text-lg font-black mb-2 text-slate-800 dark:text-white">Did you receive blood?</h3>
            <p class="text-sm text-slate-500 dark:text-slate-300 mb-6 leading-relaxed">Did you receive blood today from <b>${donorText}</b>?</p>
            <button onclick="handleRequesterVerification('${escapeJsString(data.id)}', true)" class="w-full bg-brand text-white py-4 rounded-2xl font-black mb-3 transition hover:bg-red-700">Yes, I received it</button>
            <button onclick="handleRequesterVerification('${escapeJsString(data.id)}', false)" class="w-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-4 rounded-2xl font-bold transition hover:bg-slate-200 dark:hover:bg-slate-600">No, I did not receive it</button>
        </div>`;
    document.body.appendChild(div);
}


async function finalizeVerification(verificationId, status) {
    const { data: pending, error: pendingError } = await supabaseClient
        .from('pending_verifications')
        .select('*')
        .eq('id', verificationId)
        .maybeSingle();

    if (pendingError) throw pendingError;
    if (!pending) return { ok: false, reason: 'missing' };
    if (pending.status && pending.status !== 'pending') {
        return { ok: false, reason: 'already_processed', status: pending.status };
    }

    if (status === 'verified' && pending.donor_id) {
        const { data: donorProfile, error: donorError } = await supabaseClient
            .from('donors')
            .select('total_donations, availability_locked, cooldown_until, cooldown_reason')
            .eq('user_id', pending.donor_id)
            .maybeSingle();

        if (donorError) throw donorError;

        if (isCooldownLocked(donorProfile)) {
            const lockInfo = getActiveDonorLockInfo(donorProfile);
            const { error: blockError } = await supabaseClient
                .from('pending_verifications')
                .update({
                    status: 'cooldown_blocked',
                    responded_at: new Date().toISOString(),
                    metadata: { ...(pending.metadata || {}), cooldown_until: donorProfile?.cooldown_until || null }
                })
                .eq('id', verificationId)
                .eq('status', 'pending');
            if (blockError) throw blockError;
            return { ok: false, reason: 'cooldown', until: donorProfile?.cooldown_until || null, daysRemaining: lockInfo.daysRemaining };
        }

        const totalDonations = donorProfile?.total_donations || 0;
        const now = new Date();
        const todayDate = now.toISOString().split('T')[0];
        const cooldownUntil = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
        const cooldownReason = `You donated blood on ${todayDate}. Cooldown active for 3 months.`;

        const { error: updatePendingError } = await supabaseClient
            .from('pending_verifications')
            .update({
                status,
                responded_at: new Date().toISOString()
            })
            .eq('id', verificationId)
            .eq('status', 'pending');

        if (updatePendingError) throw updatePendingError;

        const { error: updateDonorError } = await supabaseClient
            .from('donors')
            .update({
                total_donations: totalDonations + 1,
                last_donation_date: todayDate,
                is_available: false,
                availability_locked: true,
                cooldown_until: cooldownUntil,
                cooldown_reason: cooldownReason
            })
            .eq('user_id', pending.donor_id);

        if (updateDonorError) throw updateDonorError;
        return { ok: true, reason: 'verified' };
    }

    const { error: updatePendingError } = await supabaseClient
        .from('pending_verifications')
        .update({
            status,
            responded_at: new Date().toISOString()
        })
        .eq('id', verificationId)
        .eq('status', 'pending');

    if (updatePendingError) throw updatePendingError;
    return { ok: true, reason: status };
}


window.handleRequesterVerification = async function (verificationId, approved) {
    const overlay = document.getElementById('fixed-noti-overlay');
    if (overlay) overlay.style.opacity = '0.6';

    try {
        const result = await finalizeVerification(verificationId, approved ? 'verified' : 'rejected');
        if (result?.reason === 'cooldown') {
            alert(`This donor is still in the 3-month cooldown. Donation was not counted. Try again after ${result.daysRemaining} day(s).`);
        } else if (result?.reason === 'already_processed') {
            alert('This verification was already processed.');
        }
        window.location.reload();
    } catch (err) {
        console.error('handleRequesterVerification error:', err);
        alert('Verification update failed.');
        if (overlay) overlay.style.opacity = '1';
    }
};


async function processVerificationFromURL() {
    const params = new URLSearchParams(window.location.search);
    const verifyStatus = params.get('verify');
    const verifyId = params.get('verifyId') || params.get('id');

    if (!verifyStatus || !verifyId) return;

    try {
        const result = await finalizeVerification(verifyId, verifyStatus);
        if (result?.reason === 'cooldown') {
            alert(`This donor is still in the 3-month cooldown. Donation was not counted.`);
        } else if (result?.reason === 'already_processed') {
            alert('This verification was already processed.');
        } else {
            alert(verifyStatus === 'verified' ? 'Thank you! Blood receipt has been confirmed.' : 'Verification updated.');
        }
    } catch (err) {
        console.error('processVerificationFromURL error:', err);
    }

    window.history.replaceState({}, document.title, window.location.pathname);
}

async function subscribePendingVerifications() {
    const { session } = await getSessionAndProfile();
    if (!session || pendingRealtimeChannel) return;

    pendingRealtimeChannel = supabaseClient
        .channel(`pending-verifications-${session.user.id}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'pending_verifications',
                filter: `requester_id=eq.${session.user.id}`
            },
            (payload) => {
                if (payload?.new?.status === 'pending') {
                    showVerificationModal(payload.new);
                }
            }
        )
        .subscribe();
}

// ==========================================
// 8. PUSH NOTIFICATIONS & SERVICE WORKER
// ==========================================
const publicVapidKey = 'BPT3FXeFUxI6ANp9DjHLzBVftJQzoComjKwSMPB2MGGWJ1nsQNZqND2RWpxQrZ6nUUyCjBdt_pP9bk8LaUNDw1A';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
        await navigator.serviceWorker.register('sw.js');
        await navigator.serviceWorker.ready;
    } catch (err) {
        console.error('Service worker registration failed:', err);
    }
}

function listenForServiceWorkerMessages() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('message', async (event) => {
        const message = event.data;
        if (!message || message.type !== 'VERIFICATION_UPDATE') return;

        try {
            await finalizeVerification(message.id, message.status);
            window.location.reload();
        } catch (err) {
            console.error('SW message verification update failed:', err);
        }
    });
}

window.setupPushNotifications = async function () {
    const { session } = await getSessionAndProfile();
    if (!session) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;

    try {
        const registration = await navigator.serviceWorker.ready;

        let permission = Notification.permission;
        if (permission === 'default') permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
            });
        }

        await supabaseClient
            .from('donors')
            .update({ push_subscription: subscription })
            .eq('user_id', session.user.id);

        console.log('Push subscription saved successfully.');
    } catch (error) {
        console.error('Push Setup Error:', error);
    }
};


window.getPushSubscriptionStatus = async function() {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        return { supported: false, granted: false, subscribed: false };
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        return {
            supported: true,
            granted: Notification.permission === 'granted',
            subscribed: !!subscription,
            permission: Notification.permission
        };
    } catch (error) {
        console.error('Push status error:', error);
        return { supported: true, granted: Notification.permission === 'granted', subscribed: false, permission: Notification.permission };
    }
};

window.updateNotificationUI = async function() {
    const statusText = document.getElementById('notification-status-text');
    const subText = document.getElementById('notification-subtext');
    const rowBadge = document.getElementById('notification-row-badge');
    const enableBtnText = document.getElementById('enable-alerts-btn-text');
    const enableBtnIcon = document.getElementById('enable-alerts-btn-icon');

    const status = await window.getPushSubscriptionStatus();
    if (!statusText && !subText && !rowBadge && !enableBtnText && !enableBtnIcon) return;

    if (!status.supported) {
        if (statusText) statusText.innerText = 'Not supported';
        if (subText) subText.innerText = 'Your browser does not support push alerts.';
        if (rowBadge) rowBadge.innerText = 'Unavailable';
        if (enableBtnText) enableBtnText.innerText = 'Not supported';
        if (enableBtnIcon) enableBtnIcon.className = 'fa-solid fa-ban';
        return;
    }

    if (status.granted && status.subscribed) {
        if (statusText) statusText.innerText = 'Enabled';
        if (subText) subText.innerText = 'You will receive urgent blood alerts for your area.';
        if (rowBadge) rowBadge.innerText = 'On';
        if (enableBtnText) enableBtnText.innerText = 'Enabled';
        if (enableBtnIcon) enableBtnIcon.className = 'fa-solid fa-check';
        return;
    }

    if (status.permission === 'denied') {
        if (statusText) statusText.innerText = 'Blocked';
        if (subText) subText.innerText = 'Allow notifications from your browser settings.';
        if (rowBadge) rowBadge.innerText = 'Blocked';
        if (enableBtnText) enableBtnText.innerText = 'Open browser settings';
        if (enableBtnIcon) enableBtnIcon.className = 'fa-solid fa-gear';
        return;
    }

    if (statusText) statusText.innerText = 'Off';
    if (subText) subText.innerText = 'Turn on alerts for emergency requests in your area.';
    if (rowBadge) rowBadge.innerText = 'Off';
    if (enableBtnText) enableBtnText.innerText = 'Enable alerts';
    if (enableBtnIcon) enableBtnIcon.className = 'fa-solid fa-bell';
};

window.openNotificationSheet = function() {
    const overlay = document.getElementById('notification-sheet-overlay');
    const sheet = document.getElementById('notification-sheet');
    if (!overlay || !sheet) return;
    overlay.classList.remove('hidden');
    setTimeout(() => {
        overlay.classList.add('opacity-100');
        sheet.classList.remove('translate-y-full');
    }, 10);
};

window.closeNotificationSheet = function(dismiss = true) {
    const overlay = document.getElementById('notification-sheet-overlay');
    const sheet = document.getElementById('notification-sheet');
    if (!overlay || !sheet) return;
    overlay.classList.remove('opacity-100');
    sheet.classList.add('translate-y-full');
    setTimeout(() => overlay.classList.add('hidden'), 300);
    if (dismiss) localStorage.setItem('bloodlink_alert_prompt_dismissed', '1');
};

window.setupPushNotifications = async function(interactive = false) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        alert('Please log in first.');
        return false;
    }

    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('This browser does not support notifications.');
        return false;
    }

    try {
        await window.registerBloodLinkServiceWorker();
        const currentPermission = Notification.permission;
        let permission = currentPermission;

        if (interactive && currentPermission !== 'granted') {
            permission = await Notification.requestPermission();
        }

        if (permission !== 'granted') {
            await window.updateNotificationUI();
            if (permission === 'denied') {
                alert('Allow notifications from your browser settings.');
            }
            return false;
        }

        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
            });
        }

        const { error } = await supabaseClient.from('donors').update({
            push_subscription: subscription
        }).eq('user_id', session.user.id);

        if (error) {
            alert('Failed to save alerts: ' + error.message);
            return false;
        }

        localStorage.removeItem('bloodlink_alert_prompt_dismissed');
        window.closeNotificationSheet(false);
        await window.updateNotificationUI();
        return true;
    } catch (error) {
        console.error('Push Setup Error:', error);
        alert('Notification setup failed.');
        await window.updateNotificationUI();
        return false;
    }
};

window.handleNotificationCTA = async function() {
    const status = await window.getPushSubscriptionStatus();
    if (status.permission === 'denied') {
        alert('Go to browser settings and allow notifications.');
        return;
    }
    await window.setupPushNotifications(true);
};

window.maybeShowNotificationPrompt = async function() {
    const onProfilePage = window.location.pathname.includes('donor-profile.html');
    if (!onProfilePage) return;
    if (localStorage.getItem('bloodlink_alert_prompt_dismissed') === '1') return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const status = await window.getPushSubscriptionStatus();
    if (status.supported && !status.granted) {
        setTimeout(() => window.openNotificationSheet(), 900);
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    await window.registerBloodLinkServiceWorker();
    await window.updateNotificationUI();
    await window.maybeShowNotificationPrompt();
});
