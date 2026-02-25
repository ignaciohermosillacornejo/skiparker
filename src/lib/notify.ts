import notifier from 'node-notifier';
import { exec } from 'node:child_process';

export interface NotifyOptions {
  desktop?: boolean;
  sound?: boolean;
}

export function notifyAvailable(
  date: string,
  options: NotifyOptions = {}
): void {
  const { desktop = true, sound = true } = options;

  if (desktop) {
    notifier.notify({
      title: 'Ski Parker - Spot Available!',
      message: `Parking available for ${date}! Book now at the resort site.`,
      sound: sound,
      wait: false,
    });
  }

  if (sound) {
    playSound();
  }
}

function playSound(): void {
  // macOS system sound
  if (process.platform === 'darwin') {
    exec('afplay /System/Library/Sounds/Glass.aiff');
  }
  // Windows
  else if (process.platform === 'win32') {
    exec('powershell -c (New-Object Media.SoundPlayer "C:\\Windows\\Media\\notify.wav").PlaySync()');
  }
  // Linux - try paplay first, then aplay
  else {
    exec('paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || aplay /usr/share/sounds/alsa/Front_Center.wav 2>/dev/null');
  }
}
