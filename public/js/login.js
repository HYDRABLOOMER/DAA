document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('login-form');
    
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      try {
        const response = await axios.post('/login', {
          email,
          password
        });
        
        alert(response.data.message);

        window.location.href = '/home';
      } catch (error) {
        if (error.response) {
          alert(error.response.data.message);
        } else {
          alert('An error occurred. Please try again.');
        }
      }
    });
  });
