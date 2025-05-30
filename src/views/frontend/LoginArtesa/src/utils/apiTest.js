import axios from 'axios';

export const testResendVerification = async (email) => {
  try {
    const response = await axios.post(
      'https://ec2-44-216-131-63.compute-1.amazonaws.com/api/auth/resend-verification',
      { 
        mail: email,
        recaptchaToken: 'dev-mode-bypass-token'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': '69420',
          'Bypass-Tunnel-Reminder': 'true'
        }
      }
    );
    
    console.log("✅ Test directo exitoso:", response);
    return { success: true, data: response.data };
  } catch (error) {
    console.error("❌ Test directo falló:", error);
    return { success: false, error: error.message };
  }
};