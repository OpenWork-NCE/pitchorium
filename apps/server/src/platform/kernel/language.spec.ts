import { describe, expect, it } from 'vitest';
import { detectLanguage } from './language';

/**
 * Real texts of each language of the platform, written as members write them (a project, a
 * cooperative, an invitation), and a passage of a reference text of each African language
 * (Universal Declaration of Human Rights, article 1, the text franc learns from).
 */
const TEXTS: Readonly<Record<string, readonly string[]>> = {
  fr: [
    'Nous installons des pompes solaires pour les maraîchères de Thiès cette saison.',
    'Merci à toutes celles et ceux qui ont soutenu la coopérative pendant la récolte.',
  ],
  en: [
    'We are installing solar pumps for the market gardeners of Thiès this season.',
    'Thank you to everyone who supported the cooperative during the harvest.',
  ],
  sw: [
    'Kenya ni nchi iliyoko Afrika Mashariki, na mji wake mkuu ni Nairobi ambao una wakazi wengi.',
    'Habari za asubuhi! Tunatafuta wawekezaji kwa mradi wetu wa nishati ya jua katika vijiji vya Kisumu.',
    'Watu wote wamezaliwa huru, hadhi na haki zao ni sawa. Wote wamejaliwa akili na dhamiri, hivyo yapasa watendeane kindugu.',
  ],
  wo: [
    'Senegaal réew la ci Afrig gu sowwu. Mi ngi dendoo ak Gànnaar ci bëj-gànnaar, Mali ci penku, Ginne ak Ginne Bisaawóo ci bëj-saalum.',
    'Làkk wi ëpp ci réew mi mooy wolof, waaye farañse mooy làkk wu jëwriñ.',
    'Sunu mbootaay di jàppale jigéen ñi ci liggéeyu mbay ak jaay ci Tiwaawon.',
    'Jërëjëf ci seen ndimbal yépp. Ci weer wii ñu ngi tàmbali tabax pomp yu jant yi ci Cees.',
    'Jàmm nga am? Maa ngi lay bëgg wax ne sunu mbootaay dina def ndaje ci àjjuma ji ngir waxtaan ci liggéey bi.',
  ],
  ln: [
    'Kinshasa ezali mboka monene ya Republiki Demokratiki ya Kongo, mpe bato ebele bazali kofanda kuna.',
    'Mbote na bino banso! Lobi tokosala likita na biro na biso mpo na kolobela mosala ya bilanga.',
    'Bato nyonso na mbótama bazali nzambe na bonsomi mpe bakókani na limemya mpe makoki. Bazali na mayele mpe na lisosoli mpe basengeli kosálelana na bondeko.',
  ],
};

describe('detectLanguage', () => {
  for (const [language, texts] of Object.entries(TEXTS)) {
    it(`names ${language} in ISO 639-1`, () => {
      for (const text of texts) expect(detectLanguage(text), text).toBe(language);
    });
  }

  it('leaves another language, or a misread identifier, undetermined', () => {
    expect(
      detectLanguage('Estamos a instalar bombas solares para as hortelãs de Thiès nesta estação.'),
    ).toBeNull();
    expect(
      detectLanguage('Wir sammeln Geld für Solarpumpen in den Dörfern rund um Thiès im Senegal.'),
    ).toBeNull();
    expect(detectLanguage('Parcours manuel bf6026b3-df93-4607-8687-4102b4559c4f')).toBeNull();
  });

  it('leaves a short or empty text undetermined', () => {
    expect(detectLanguage('Merci')).toBeNull();
    expect(detectLanguage(null)).toBeNull();
    expect(detectLanguage('')).toBeNull();
  });
});
