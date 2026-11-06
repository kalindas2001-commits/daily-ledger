package app.lovable.p51e3df563f8544a19a54f0253ef54f26;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Telephony;
import android.telephony.SmsMessage;

/** Captures delivery events without relying on a running WebView. Android may delay or suppress delivery. */
public class PaymentSmsReceiver extends BroadcastReceiver {
  @Override public void onReceive(Context context, Intent intent) {
    if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
    SharedPreferences settings = context.getSharedPreferences(SmsPendingStore.SETTINGS, Context.MODE_PRIVATE);
    if (!settings.getBoolean("enabled", false)) return;
    String owner = settings.getString("owner", null);
    if (owner == null) return;
    final PendingResult pending = goAsync();
    new Thread(() -> {
      try (SmsPendingStore store = new SmsPendingStore(context)) {
        SmsMessage[] parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (parts == null || parts.length == 0) return;
        StringBuilder body = new StringBuilder();
        for (SmsMessage part : parts) { if (part != null && part.getMessageBody() != null) body.append(part.getMessageBody()); }
        // Use receipt time rather than claiming that the sender's timestamp is the payment time.
        if (settings.getBoolean("enabled", false) && owner.equals(settings.getString("owner", null))) {
          store.enqueue(owner, parts[0].getOriginatingAddress(), body.toString(), System.currentTimeMillis());
        }
      } catch (Exception ignored) {
        // The next authenticated foreground scan reconciles with the carrier SMS inbox.
      } finally { pending.finish(); }
    }, "payment-sms-capture").start();
  }
}