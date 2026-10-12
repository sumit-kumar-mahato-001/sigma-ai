import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import get_settings

def send_otp_email(to_email: str, otp_code: str, purpose: str = "signup") -> bool:
    settings = get_settings()
    
    if not settings.smtp_host or not settings.smtp_user or not settings.smtp_pass:
        print(f"SMTP not configured. Generated OTP for {to_email} ({purpose}): {otp_code}")
        return True
        
    try:
        msg = MIMEMultipart("alternative")
        
        if purpose == "signup":
            msg["Subject"] = "Your Sigma AI Signup OTP"
        else:
            msg["Subject"] = "Your Sigma AI Password Reset OTP"
            
        msg["From"] = settings.smtp_from or settings.smtp_user
        msg["To"] = to_email
        
        text_body = f"Your OTP code is {otp_code}. It will expire soon."
        html_body = f"""
        <html>
          <body>
            <h2>Sigma AI</h2>
            <p>Your OTP code is: <strong>{otp_code}</strong></p>
            <p>Please use this to complete your {purpose}.</p>
          </body>
        </html>
        """
        
        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_pass)
            server.send_message(msg)
            
        return True
    except Exception as e:
        print(f"Error sending email to {to_email}: {e}")
        return False
