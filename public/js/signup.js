document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('signup-form');
    
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const university = document.getElementById('university').value;
      const password = document.getElementById('password').value;
      const studentId = document.getElementById('studentId').value;
      
      try {
        const response = await axios.post('/signup', {
          name,
          email,
          university,
          studentId,
          password
        });
        
        alert(response.data.message);
        window.location.href = '/login';
      } catch (error) {
        if (error.response) {
          alert(error.response.data.message);
        } else {
          alert('An error occurred. Please try again.');
        }
      }
    });
  });
