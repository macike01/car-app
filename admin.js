// Admin page script for managing clubs using Supabase

// Replace these placeholders with your Supabase project credentials.
const SUPABASE_URL = 'https://muovvomzkjdrlbargyve.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Initialise the Supabase client. The supabase global is provided by the CDN script in admin.html.
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Fetches the list of clubs from the Supabase `clubs` table and populates
 * the HTML table body. Each row includes a delete button that allows
 * administrators to remove a club by its primary key ID.
 */
async function fetchClubs() {
  const { data, error } = await supabase.from('clubs').select('*');
  const tableBody = document.getElementById('clubTableBody');
  tableBody.innerHTML = '';
  if (error) {
    console.error('Error fetching clubs:', error);
    tableBody.innerHTML = '<tr><td colspan="4">Failed to load clubs.</td></tr>';
    return;
  }
  data.forEach(club => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${club.name}</td>
      <td>${club.desc}</td>
      <td>${club.img}</td>
      <td><button class="btn danger" onclick="deleteClub(${club.id})">Delete</button></td>
    `;
    tableBody.appendChild(row);
  });
}

/**
 * Handles form submission for adding a new club. Reads values from the
 * form inputs and inserts a new record into the Supabase `clubs` table.
 * After insertion, it refreshes the club list and resets the form.
 * @param {Event} event - The form submission event.
 */
async function addClub(event) {
  event.preventDefault();
  const nameInput = document.getElementById('newClubName');
  const descInput = document.getElementById('newClubDesc');
  const imgInput = document.getElementById('newClubImg');
  const name = nameInput.value.trim();
  const desc = descInput.value.trim();
  const img = imgInput.value.trim();
  if (!name || !desc || !img) {
    alert('Please fill in all fields before adding a club.');
    return;
  }
  const { error } = await supabase.from('clubs').insert([{ name, desc, img }]);
  if (error) {
    alert('Error adding club: ' + error.message);
    return;
  }
  // Refresh the list and clear the form
  await fetchClubs();
  nameInput.value = '';
  descInput.value = '';
  imgInput.value = '';
}

/**
 * Deletes a club record from the Supabase `clubs` table by its ID and
 * refreshes the displayed list. Should be attached to the delete buttons.
 * @param {number} id - Primary key of the club to remove.
 */
async function deleteClub(id) {
  const { error } = await supabase.from('clubs').delete().eq('id', id);
  if (error) {
    alert('Error deleting club: ' + error.message);
    return;
  }
  fetchClubs();
}

// Hook up the form submission and populate the initial list on page load.
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('newClubForm');
  if (form) {
    form.addEventListener('submit', addClub);
  }
  fetchClubs();
});
