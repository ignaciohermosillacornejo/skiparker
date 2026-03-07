import notifier from 'node-notifier';
import { execFile } from 'node:child_process';

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
  if (process.platform === 'darwin') {
    execFile('afplay', ['/System/Library/Sounds/Glass.aiff']);
  } else if (process.platform === 'win32') {
    execFile('powershell', ['-c', '(New-Object Media.SoundPlayer "C:\\Windows\\Media\\notify.wav").PlaySync()']);
  } else {
    execFile('paplay', ['/usr/share/sounds/freedesktop/stereo/complete.oga'], (err) => {
      if (err) {
        execFile('aplay', ['/usr/share/sounds/alsa/Front_Center.wav']);
      }
    });
  }
}
