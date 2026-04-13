
let allDonors = [];
let userDistrict = '';
let userUpazila = '';
let allDistrictsData = [];
let allUpazilasData = [];

document.addEventListener('DOMContentLoaded', async () => {
  const bloodGroup = new URLSearchParams(window.location.search).get('bg');
  if (!bloodGroup) {
    window.location.href = 'index.html';
    return;
  }

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      const { data: profile } = await supabaseClient.from('donors').select('district, upazila').eq('user_id', session.user.id).single();
      if (profile) {
        userDistrict = profile.district || '';
        userUpazila = profile.upazila || '';
      }
    }

    await loadGeocodeData();

    const { data, error } = await supabaseClient
      .from('donors')
      .select('*')
      .eq('blood_group', bloodGroup)
      .eq('is_available', true)
      .order('total_donations', { ascending: false });

    if (error) throw error;

    allDonors = data || [];
    renderDonors();

    document.getElementById('filter-district').addEventListener('change', event => {
      updateUpazilaOptions(event.target.value);
      renderDonors();
    });
    document.getElementById('filter-upazila').addEventListener('change', renderDonors);
  } catch (error) {
    console.error(error);
    document.getElementById('search-results-container').innerHTML = `<div class="page-empty p-10 text-center text-sm font-bold text-slate-500">${t('Failed to load donor data.', 'ডোনারের তথ্য লোড করা যায়নি।')}</div>`;
    document.getElementById('result-header').textContent = t('Failed to load', 'লোড করা যায়নি');
  }
});

async function loadGeocodeData() {
  const [districtResponse, upazilaResponse] = await Promise.all([
    fetch('https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/districts/districts.json'),
    fetch('https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/upazilas/upazilas.json')
  ]);

  allDistrictsData = (await districtResponse.json())[2].data || [];
  allUpazilasData = (await upazilaResponse.json())[2].data || [];

  const districtSelect = document.getElementById('filter-district');
  districtSelect.innerHTML = `<option value="">${t('All Districts', 'সব জেলা')}</option>`;
  allDistrictsData.sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
    const option = new Option(item.name, item.name);
    if (item.name === userDistrict) option.selected = true;
    districtSelect.add(option);
  });

  if (userDistrict) {
    updateUpazilaOptions(userDistrict, userUpazila);
  }
}

function updateUpazilaOptions(districtName, selectedUpazila = '') {
  const upazilaSelect = document.getElementById('filter-upazila');
  upazilaSelect.innerHTML = `<option value="">${t('All Upazilas', 'সব উপজেলা')}</option>`;

  if (!districtName) {
    upazilaSelect.disabled = true;
    return;
  }

  const district = allDistrictsData.find(item => item.name === districtName);
  if (!district) {
    upazilaSelect.disabled = true;
    return;
  }

  const filteredUpazilas = allUpazilasData.filter(item => item.district_id === district.id);
  filteredUpazilas.sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
    const option = new Option(item.name, item.name);
    if (item.name === selectedUpazila) option.selected = true;
    upazilaSelect.add(option);
  });

  upazilaSelect.disabled = false;
}

function renderDonors() {
  const district = document.getElementById('filter-district').value;
  const upazila = document.getElementById('filter-upazila').value;
  const container = document.getElementById('search-results-container');

  const filtered = allDonors.filter(item => {
    const matchDistrict = !district || item.district === district;
    const matchUpazila = !upazila || item.upazila === upazila;
    return matchDistrict && matchUpazila;
  });

  document.getElementById('result-header').innerHTML = `${t('Donors found', 'ডোনার পাওয়া গেছে')}: <span class="text-brand font-black">${filtered.length}</span>`;

  if (!filtered.length) {
    container.innerHTML = `<div class="page-empty p-10 text-center font-bold text-slate-500">${t('No donors found in the selected area.', 'নির্বাচিত এলাকায় কোনো ডোনার পাওয়া যায়নি।')}</div>`;
    return;
  }

  container.innerHTML = filtered.map(donor => {
    const avatar = donor.avatar_url
      ? `<img src="${donor.avatar_url}" class="w-full h-full object-cover">`
      : `<span class="text-xl font-black">${donor.full_name ? donor.full_name.charAt(0) : 'U'}</span>`;

    return `
      <article onclick="window.location.href='public-profile.html?id=${donor.user_id}'" class="cursor-pointer premium-card p-4 space-y-4 transition-all hover:shadow-md active:scale-[0.99]">
        <div class="flex items-center gap-3">
          <div class="w-14 h-14 bg-red-50 dark:bg-slate-700 text-brand rounded-full flex items-center justify-center border-2 border-red-100 dark:border-slate-600 shadow-inner overflow-hidden flex-shrink-0">${avatar}</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <h3 class="font-bold text-slate-900 dark:text-white text-base truncate">${donor.full_name || t('Unnamed donor', 'নামহীন ডোনার')}</h3>
              <span class="bg-red-50 dark:bg-red-900/30 text-brand text-xs font-black px-2.5 py-1 rounded-lg border border-red-100 dark:border-red-800 flex-shrink-0">${donor.blood_group}</span>
            </div>
            <p class="text-xs text-slate-500 font-medium truncate mt-1"><i class="fa-solid fa-location-dot text-brand/70 mr-0.5"></i>${[donor.upazila, donor.district].filter(Boolean).join(', ') || t('Location not set', 'লোকেশন সেট করা হয়নি')}</p>
          </div>
        </div>
        <div class="flex gap-2" onclick="event.stopPropagation()">
          <a href="tel:${donor.phone_number || ''}" onclick="initiateCallTracking(event, '${donor.phone_number || ''}', '${donor.user_id}', '${(donor.full_name || '').replace(/'/g, '&#39;')}')" class="flex-1 bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 py-3 rounded-2xl text-sm font-bold text-center flex justify-center items-center gap-2"><i class="fa-solid fa-phone"></i>${t('Call donor', 'ডোনারকে কল')}</a>
          <a href="https://wa.me/+88${donor.phone_number || ''}" target="_blank" class="w-14 bg-green-500 text-white rounded-2xl flex items-center justify-center text-xl"><i class="fa-brands fa-whatsapp"></i></a>
        </div>
      </article>
    `;
  }).join('');
}
