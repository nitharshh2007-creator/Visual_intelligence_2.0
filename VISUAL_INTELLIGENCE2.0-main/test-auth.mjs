import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://seleddedqzxxxoitrzbx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlbGVkZGVkcXp4eHhvaXRyemJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NjYyMzUsImV4cCI6MjEwNzE0MjIzNX0.hGPl-f-EvI9RxQh7gRMk0LGwrwflGB0zte_Cxm7T0hE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSignUp() {
  console.log('Testing sign up to see if user exists...');
  const { data, error } = await supabase.auth.signUp({
    email: 'admin88@admin.com',
    password: 'Admin0'
  });
  
  if (error) {
    console.error('Error signing up:', error.message);
  } else {
    console.log('Successfully signed up! User did not exist before.', data.user?.id);
  }
}

testSignUp();
