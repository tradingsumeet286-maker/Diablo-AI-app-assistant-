import { useState, useEffect } from 'react';

export interface BatteryState {
  level: number; // 0 to 100
  charging: boolean;
  supported: boolean;
  chargingTime?: number;
  dischargingTime?: number;
}

export function useBatteryStatus(): BatteryState {
  const [batteryState, setBatteryState] = useState<BatteryState>({
    level: 88,
    charging: false,
    supported: false,
  });

  useEffect(() => {
    let mounted = true;
    let batteryObj: any = null;

    const handleBatteryUpdate = () => {
      if (!batteryObj || !mounted) return;
      const pct = Math.round(batteryObj.level * 100);
      setBatteryState({
        level: isNaN(pct) ? 88 : Math.max(0, Math.min(100, pct)),
        charging: Boolean(batteryObj.charging),
        supported: true,
        chargingTime: batteryObj.chargingTime,
        dischargingTime: batteryObj.dischargingTime,
      });
    };

    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      try {
        (navigator as any).getBattery().then((batt: any) => {
          if (!mounted) return;
          batteryObj = batt;
          handleBatteryUpdate();

          batt.addEventListener('levelchange', handleBatteryUpdate);
          batt.addEventListener('chargingchange', handleBatteryUpdate);
        }).catch((err: any) => {
          console.warn('[Battery Status API] Not permitted or unavailable:', err);
          if (mounted) {
            setBatteryState((prev) => ({ ...prev, supported: false }));
          }
        });
      } catch (err) {
        console.warn('[Battery Status API] Error accessing navigator.getBattery:', err);
      }
    }

    return () => {
      mounted = false;
      if (batteryObj) {
        try {
          batteryObj.removeEventListener('levelchange', handleBatteryUpdate);
          batteryObj.removeEventListener('chargingchange', handleBatteryUpdate);
        } catch (_) {}
      }
    };
  }, []);

  return batteryState;
}
