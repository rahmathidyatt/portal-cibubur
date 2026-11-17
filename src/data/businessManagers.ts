export interface BusinessManager {
  /** Juga dipakai sebagai nama file foto di src/assets/managers/<id>.webp */
  id: string;
  name: string;
  code: string;
  tier: string;
}

/** Business Manager Brighton HUB Cibubur (urutan tampil di beranda). */
export const BUSINESS_MANAGERS: BusinessManager[] = [
  { id: 'rudy', name: 'RUDY, CRA®', code: 'AUFZ', tier: 'Brighton Warrior' },
  { id: 'adolf', name: 'ADOLF, CRA®', code: 'WIID', tier: 'Brighton Warrior' },
  { id: 'vira', name: 'VIRA', code: 'AUTU', tier: 'Brighton Warrior' },
  { id: 'edah', name: 'EDAH, CRA®', code: 'DDOG', tier: 'Brighton Warrior' },
  { id: 'risda', name: 'RISDA, CRA®', code: 'TRVG', tier: 'Brighton Champion' },
  { id: 'vee', name: 'VEE, CRA®', code: 'BMWD', tier: 'Brighton Vision' },
  { id: 'moren', name: 'MOREN', code: 'VNIL', tier: 'Brighton Champion' },
  { id: 'ade', name: 'ADE', code: 'FRJU', tier: 'Brighton Winner' },
  { id: 'toni', name: 'TONI, CRA®', code: 'ACYS', tier: 'Brighton Priority' }
];
