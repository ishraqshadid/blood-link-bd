
let leaderboardMode = 'all';
let leaderboardDistrict = '';
let donorsCache = [];
let eventsCache = [];

document.addEventListener('DOMContentLoaded', initLeaderboard);

async function initLeaderboard() {
  bindLeaderboardTabs();
  await loadPreferredDistrict();
  await fetchLeaderboardData();
  fillLeaderboardDistricts();
  renderLeaderboard();
}

async function loadPreferredDistrict() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    const { data: profile } = await supabaseClient.from('donors').select('district').eq('user_id', session.user.id).single();
    if (profile?.district) leaderboardDistrict = profile.district;
  } catch (_) {}
}

function bindLeaderboardTabs() {
  document.querySelectorAll('.lb-tab').forEach(button => {
    button.addEventListener('click', () => {
      leaderboardMode = button.dataset.mode;
      document.querySelectorAll('.lb-tab').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      const districtWrap = document.getElementById('leaderboard-district-wrap');
      districtWrap.classList.toggle('hidden', leaderboardMode !== 'district');
      renderLeaderboard();
    });
  });

  const districtSelect = document.getElementById('leaderboard-district-select');
  districtSelect?.addEventListener('change', () => {
    leaderboardDistrict = districtSelect.value;
    renderLeaderboard();
  });
}

async function fetchLeaderboardData() {
  const { data: donors, error: donorError } = await supabaseClient
    .from('donors')
    .select('user_id, full_name, avatar_url, district, upazila, total_donations, is_available')
    .order('total_donations', { ascending: false })
    .limit(300);

  if (!donorError && donors) donorsCache = donors;

  const { data: events, error: eventError } = await supabaseClient
    .from('donation_events')
    .select('donor_id, points, verified_at, donors!inner(full_name, avatar_url, district, upazila, is_available)')
    .order('verified_at', { ascending: false })
    .limit(1000);

  if (!eventError && events) eventsCache = events;
}

function fillLeaderboardDistricts() {
  const select = document.getElementById('leaderboard-district-select');
  if (!select) return;

  const districts = [...new Set((donorsCache || []).map(item => item.district).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const current = select.value;
  select.innerHTML = `<option value="">${'Select district'}</option>`;
  districts.forEach(district => select.add(new Option(district, district)));
  if (!leaderboardDistrict) {
    leaderboardDistrict = current || '';
  }
  if (leaderboardDistrict) select.value = leaderboardDistrict;
}

function aggregateRows(mode) {
  const now = Date.now();
  if ((mode === 'weekly' || mode === 'monthly') && eventsCache.length) {
    const rangeStart = mode === 'weekly'
      ? new Date(now - 7 * 24 * 60 * 60 * 1000)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const grouped = new Map();
    eventsCache.forEach(event => {
      const verifiedAt = new Date(event.verified_at || 0);
      if (!(verifiedAt >= rangeStart)) return;
      const donor = event.donors || {};
      const entry = grouped.get(event.donor_id) || {
        user_id: event.donor_id,
        full_name: donor.full_name || 'Unnamed donor',
        avatar_url: donor.avatar_url || '',
        district: donor.district || '',
        upazila: donor.upazila || '',
        is_available: donor.is_available,
        points: 0,
        verified_count: 0
      };
      entry.points += Number(event.points || 0);
      entry.verified_count += 1;
      grouped.set(event.donor_id, entry);
    });
    return [...grouped.values()].sort((a, b) => b.points - a.points || b.verified_count - a.verified_count);
  }

  let rows = (donorsCache || []).map(item => ({
    user_id: item.user_id,
    full_name: item.full_name || 'Unnamed donor',
    avatar_url: item.avatar_url || '',
    district: item.district || '',
    upazila: item.upazila || '',
    is_available: item.is_available,
    points: Number(item.total_donations || 0) * 100,
    verified_count: Number(item.total_donations || 0)
  })).filter(item => item.verified_count > 0);

  if (mode === 'district' && leaderboardDistrict) {
    rows = rows.filter(item => item.district === leaderboardDistrict);
  }

  return rows.sort((a, b) => b.points - a.points || b.verified_count - a.verified_count);
}

function renderLeaderboard() {
  const podium = document.getElementById('leaderboard-podium');
  const list = document.getElementById('leaderboard-list');
  const empty = document.getElementById('leaderboard-empty');

  fillLeaderboardDistricts();

  const rows = aggregateRows(leaderboardMode);
  const filteredRows = leaderboardMode === 'district' && !leaderboardDistrict ? [] : rows;

  if (!filteredRows.length) {
    empty.classList.remove('hidden');
    podium.innerHTML = '';
    list.innerHTML = '';
    return;
  }

  empty.classList.add('hidden');
  const topThree = filteredRows.slice(0, 3);
  podium.innerHTML = topThree.map((item, index) => {
    const rank = index + 1;
    const size = rank === 1 ? 'w-20 h-20' : 'w-16 h-16';
    const border = rank === 1 ? 'border-amber-400' : rank === 2 ? 'border-slate-300' : 'border-orange-300';
    const meta = leaderboardMode === 'all' || leaderboardMode === 'district'
      ? `${item.points} ${'pts'}`
      : `${item.points} ${'pts'} · ${item.verified_count} ${'verified'}`;
    const avatar = item.avatar_url
      ? `<img src="${item.avatar_url}" alt="${item.full_name}" class="rounded-full w-full h-full object-cover">`
      : `<div class="rounded-full w-full h-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-black text-brand">${(item.full_name || 'U').charAt(0)}</div>`;

    return `
      <div class="flex flex-col items-center ${rank === 1 ? 'order-2' : rank === 2 ? 'order-1 mt-6' : 'order-3 mt-10'}">
        <div class="${size} rounded-full border-4 ${border} relative mb-2 overflow-hidden shadow-lg">
          ${avatar}
          ${rank === 1 ? '<i class="fa-solid fa-crown absolute -top-5 left-1/2 -translate-x-1/2 text-amber-400 text-xl"></i>' : ''}
          <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">${rank}</div>
        </div>
        <p class="text-xs font-bold dark:text-white truncate w-24 text-center">${item.full_name}</p>
        <p class="text-[11px] text-brand font-bold">${meta}</p>
      </div>
    `;
  }).join('');

  list.innerHTML = filteredRows.slice(3).map((item, index) => {
    const rank = index + 4;
    const location = [item.upazila, item.district].filter(Boolean).join(', ') || 'Area not set';
    const badge = item.is_available ? `<span class="premium-chip">${'Available'}</span>` : `<span class="premium-chip" style="color:#f97316;border-color:rgba(251,146,60,.18);background:rgba(251,146,60,.08)">${'Cooling down'}</span>`;
    const meta = leaderboardMode === 'all' || leaderboardMode === 'district'
      ? `${item.points}`
      : `${item.points} · ${item.verified_count}`;
    const smallLabel = leaderboardMode === 'all' || leaderboardMode === 'district' ? 'points' : 'pts · verified';
    return `
      <div class="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition border-b border-slate-50 dark:border-slate-700">
        <span class="font-bold text-slate-400 w-4">${rank}</span>
        <div class="flex-1 flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500 text-sm overflow-hidden">
            ${item.avatar_url ? `<img src="${item.avatar_url}" alt="${item.full_name}" class="w-full h-full object-cover">` : (item.full_name || 'U').charAt(0)}
          </div>
          <div class="min-w-0">
            <p class="text-sm font-bold dark:text-white truncate">${item.full_name}</p>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate">${location}</p>
          </div>
        </div>
        <div class="text-right">
          ${badge}
          <p class="font-bold text-sm dark:text-white mt-1">${meta}</p>
          <p class="text-[11px] text-slate-500 dark:text-slate-400">${smallLabel}</p>
        </div>
      </div>
    `;
  }).join('');
}
