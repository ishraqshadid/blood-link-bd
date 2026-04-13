
let allRequests = [];
let districtData = [];
let upazilaData = [];

document.addEventListener('DOMContentLoaded', async () => {
  const districtSelect = document.getElementById('req-filter-district');
  const upazilaSelect = document.getElementById('req-filter-upazila');
  const bloodSelect = document.getElementById('req-filter-blood');

  const { data: { session } } = await supabaseClient.auth.getSession();
  let defaultDistrict = '';
  let defaultUpazila = '';

  if (session) {
    const { data: profile } = await supabaseClient.from('donors').select('district, upazila').eq('user_id', session.user.id).single();
    if (profile) {
      defaultDistrict = profile.district || '';
      defaultUpazila = profile.upazila || '';
    }
  }

  try {
    const [districtResponse, upazilaResponse] = await Promise.all([
      fetch('https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/districts/districts.json'),
      fetch('https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/upazilas/upazilas.json')
    ]);

    districtData = (await districtResponse.json())[2].data || [];
    upazilaData = (await upazilaResponse.json())[2].data || [];

    districtData.sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
      const option = new Option(item.name, item.name);
      if (item.name === defaultDistrict) option.selected = true;
      districtSelect.add(option);
    });

    if (defaultDistrict) {
      fillUpazilas(defaultDistrict, defaultUpazila);
    }
  } catch (error) {
    console.error(error);
  }

  const { data, error } = await supabaseClient.from('blood_requests').select('*').order('created_at', { ascending: false });
  if (error) {
    document.getElementById('requests-container').innerHTML = `<div class="page-empty p-10 text-center text-sm font-bold text-slate-500">${t('Failed to load blood posts.', 'রক্তের পোস্ট লোড করা যায়নি।')}</div>`;
    return;
  }

  allRequests = data || [];
  renderRequests();

  districtSelect.addEventListener('change', () => {
    fillUpazilas(districtSelect.value);
    renderRequests();
  });
  upazilaSelect.addEventListener('change', renderRequests);
  bloodSelect.addEventListener('change', renderRequests);
});

function fillUpazilas(districtName, selectedValue = '') {
  const upazilaSelect = document.getElementById('req-filter-upazila');
  upazilaSelect.innerHTML = `<option value="">${t('All Upazilas', 'সব উপজেলা')}</option>`;

  if (!districtName) {
    upazilaSelect.disabled = true;
    return;
  }

  const district = districtData.find(item => item.name === districtName);
  if (!district) {
    upazilaSelect.disabled = true;
    return;
  }

  const filtered = upazilaData.filter(item => item.district_id === district.id);
  filtered.sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
    const option = new Option(item.name, item.name);
    if (item.name === selectedValue) option.selected = true;
    upazilaSelect.add(option);
  });

  upazilaSelect.disabled = false;
}

function getVisibleRequests() {
  const district = document.getElementById('req-filter-district').value;
  const upazila = document.getElementById('req-filter-upazila').value;
  const bloodGroup = document.getElementById('req-filter-blood').value;

  return allRequests.filter(item => {
    const matchDistrict = !district || item.district === district;
    const matchUpazila = !upazila || item.upazila === upazila;
    const matchBlood = !bloodGroup || item.blood_group === bloodGroup;
    const isNotExpired = !item.created_at || (Date.now() - new Date(item.created_at).getTime()) < (4 * 24 * 60 * 60 * 1000);
    const isNotFulfilled = !item.status || item.status === 'open';
    return matchDistrict && matchUpazila && matchBlood && isNotExpired && isNotFulfilled;
  });
}

function renderRequests() {
  const container = document.getElementById('requests-container');
  const requests = getVisibleRequests();

  if (!requests.length) {
    container.innerHTML = `<div class="page-empty p-10 text-center"><i class="fa-solid fa-folder-open text-4xl text-slate-300 mb-3"></i><h3 class="font-bold text-slate-700 dark:text-white">${t('No matching posts found', 'মিল পাওয়া যায়নি')}</h3><p class="text-xs text-slate-500 mt-1">${t('Try changing your filters.', 'ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন।')}</p></div>`;
    return;
  }

  container.innerHTML = requests.map(item => {
    const urgentTone = item.urgency_level && /critical|icu|pregnant|surgery/i.test(item.urgency_level);
    const createdText = formatDateTime(item.created_at);
    return `
      <article class="premium-card p-5 space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 text-brand flex items-center justify-center font-black text-xl border border-red-100 dark:border-red-800/30">${item.blood_group || '--'}</div>
            <div>
              <h3 class="font-bold text-slate-900 dark:text-white">${item.patient_name || t('Unknown patient', 'অজানা রোগী')}</h3>
              <p class="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">${item.urgency_level || t('Regular request', 'সাধারণ অনুরোধ')}</p>
            </div>
          </div>
          <span class="premium-chip ${urgentTone ? '' : 'text-slate-500'}">${item.units || 0} ${t('bag', 'ব্যাগ')}</span>
        </div>
        <div class="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <p><i class="fa-solid fa-hospital text-brand mr-2"></i>${item.hospital_name || t('Hospital not set', 'হাসপাতালের নাম দেওয়া হয়নি')}</p>
          <p><i class="fa-solid fa-location-dot text-brand mr-2"></i>${[item.upazila, item.district].filter(Boolean).join(', ') || t('Area not set', 'এলাকা দেওয়া হয়নি')}</p>
          <p><i class="fa-regular fa-clock text-brand mr-2"></i>${createdText}</p>
        </div>
        <div class="flex gap-2">
          <a href="request-details.html?id=${item.id}" class="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white py-3 rounded-2xl text-sm font-bold text-center">${t('View details', 'বিস্তারিত')}</a>
          <a href="tel:${item.contact_number || ''}" class="flex-1 bg-brand text-white py-3 rounded-2xl text-sm font-bold text-center">${t('Call now', 'এখনই কল')}</a>
        </div>
      </article>
    `;
  }).join('');
}
