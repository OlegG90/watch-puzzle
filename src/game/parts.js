// The catalogue of parts, in the order a watchmaker would fit them.
//
//   kind     parts of the same kind are interchangeable and stack in the tray
//   side     'train' | 'dial' | 'any': which face must be towards the player
//   pos      slot centre (mm); hitR is how far from it a drop still counts
//   hitZ     height of the slot, for projecting the finger onto the movement
//   requires what must already be in place
//   basic    the player fits this in Apprentice; other parts fit themselves
//   screw    fits loose and must then be tightened with the screwdriver
//   tight    refuses to go on while this side has loose screws: 'dial' | 'all'

import { POS } from './layout.js';

const O = [0, 0];

const part = (id, name, side, pos, hitZ, requires, opts = {}) => ({
  id,
  name,
  side,
  pos,
  hitZ,
  requires,
  kind: opts.kind ?? id,
  hitR: opts.hitR ?? 2.5,
  basic: opts.basic ?? false,
  screw: opts.screw ?? false,
  tight: opts.tight ?? null,
  desc: opts.desc ?? '',
});

const SCREW_DESC = {
  'screw-bridge': 'Великий гвинт із синьої сталі. Притискає міст до платини. Після встановлення його треба затягнути викруткою.',
  'screw-wheel': 'Гвинт із широкою головкою. Тримає колесо заводу на його квадраті чи осі. Потребує викрутки.',
  'screw-small': 'Найменший гвинт механізму. Його легко загубити навіть на справжньому столі майстра. Потребує викрутки.',
  'screw-dial': 'Гвинт на зворотному боці платини, що затискає ніжку циферблата. Потребує викрутки.',
};

const SCREW_NAME = {
  'screw-bridge': 'Гвинт моста',
  'screw-wheel': 'Гвинт колеса',
  'screw-small': 'Малий гвинт',
  'screw-dial': 'Гвинт циферблата',
};

const screw = (id, kind, side, pos, hitZ, requires) =>
  part(id, SCREW_NAME[kind], side, pos, hitZ, requires, {
    kind,
    screw: true,
    hitR: 1.5,
    desc: SCREW_DESC[kind],
  });

export const PARTS = [
  part('mainplate', 'Платина', 'any', O, 0, [], {
    basic: true,
    hitR: 18,
    desc: 'Основа механізму. У цій латунній пластині є отвори для всіх осей, а на ній тримаються всі мости.',
  }),

  // The barrel
  part('drum', 'Барабан', 'train', POS.barrel, 2, ['mainplate'], {
    basic: true,
    hitR: 6,
    desc: 'Зубчастий барабан ховає в собі заводну пружину. Це він крутить усю колісну передачу.',
  }),
  part('mainspring', 'Заводна пружина', 'train', POS.barrel, 2, ['drum'], {
    hitR: 6,
    desc: 'Довга стрічка зі сталі. Заводячи годинник, ви згортаєте її, а вона, розгортаючись, живить механізм понад добу.',
  }),
  part('arbor', 'Вал барабана', 'train', POS.barrel, 2, ['mainspring'], {
    desc: 'Вісь у центрі барабана. За неї зачеплений внутрішній кінець пружини.',
  }),
  part('barrelCover', 'Кришка барабана', 'train', POS.barrel, 3, ['arbor'], {
    hitR: 6,
    desc: 'Закриває барабан, щоб пружина не вискочила назовні.',
  }),

  // The going train
  part('fourth', 'Секундне колесо', 'train', POS.fourth, 1.1, ['mainplate'], {
    basic: true,
    desc: 'Робить один оберт за хвилину. На його довгій осі, по той бік платини, сидить секундна стрілка.',
  }),
  part('third', 'Проміжне колесо', 'train', POS.third, 2.3, ['fourth'], {
    basic: true,
    desc: 'Передає рух від центрального колеса до секундного. Обертається у зворотний бік.',
  }),
  part('escape', 'Анкерне колесо', 'train', POS.escape, 3.4, ['fourth'], {
    basic: true,
    hitR: 2,
    desc: 'Колесо зі скошеними зубцями. Анкерна вилка випускає його по одному зубцю: звідси й цокання.',
  }),
  part('centre', 'Центральне колесо', 'train', O, 3.3, ['third', 'barrelCover'], {
    basic: true,
    hitR: 4,
    desc: 'Робить один оберт за годину. Розташоване в центрі механізму й несе хвилинну стрілку.',
  }),

  part('trainBridge', 'Міст передачі', 'train', [1, -6], 5.8, ['centre', 'third', 'fourth', 'escape'], {
    basic: true,
    hitR: 6,
    desc: 'Тримає верхні цапфи коліс передачі. Без нього колеса просто випали б.',
  }),
  screw('trainScrew1', 'screw-bridge', 'train', POS.trainScrew1, 5.8, ['trainBridge']),
  screw('trainScrew2', 'screw-bridge', 'train', POS.trainScrew2, 5.8, ['trainBridge']),
  screw('trainScrew3', 'screw-bridge', 'train', POS.trainScrew3, 5.8, ['trainBridge']),

  part('barrelBridge', 'Міст барабана', 'train', POS.barrel, 5, ['barrelCover'], {
    basic: true,
    hitR: 6,
    desc: 'Широкий міст над барабаном. На ньому ж розташовані храпове колесо й коронне колесо.',
  }),
  screw('barrelScrew1', 'screw-bridge', 'train', POS.barrelScrew1, 5, ['barrelBridge']),
  screw('barrelScrew2', 'screw-bridge', 'train', POS.barrelScrew2, 5, ['barrelBridge']),

  // Winding, train side
  part('ratchet', 'Храпове колесо', 'train', POS.barrel, 5.6, ['barrelBridge'], {
    basic: true,
    hitR: 4.5,
    desc: 'Сидить на валу барабана. Коли ви заводите годинник, воно натягує пружину.',
  }),
  screw('ratchetScrew', 'screw-wheel', 'train', POS.barrel, 6, ['ratchet']),
  part('crownWheel', 'Коронне колесо', 'train', POS.crownWheel, 5.6, ['barrelBridge'], {
    hitR: 3,
    desc: 'Передає оберт заводної головки на храпове колесо.',
  }),
  screw('crownWheelScrew', 'screw-wheel', 'train', POS.crownWheel, 6, ['crownWheel']),
  part('click', 'Собачка', 'train', POS.click, 5.6, ['ratchet'], {
    hitR: 2,
    desc: 'Не дає храповому колесу прокрутитись назад. Це її тріскіт ви чуєте під час заводу.',
  }),
  part('clickSpring', 'Пружина собачки', 'train', POS.clickSpring, 5.6, ['click'], {
    hitR: 2,
    desc: 'Притискає собачку до зубців храпового колеса.',
  }),
  screw('clickScrew', 'screw-small', 'train', POS.click, 6, ['clickSpring']),

  // The escapement and the balance
  part('pallet', 'Анкерна вилка', 'train', POS.pallet, 3.4, ['escape'], {
    basic: true,
    hitR: 2,
    desc: 'Гойдається туди й назад, по черзі затримуючи й випускаючи анкерне колесо, і підштовхує баланс.',
  }),
  part('palletBridge', 'Міст вилки', 'train', POS.pallet, 5, ['pallet'], {
    basic: true,
    hitR: 2.5,
    desc: 'Маленький міст, що утримує вісь анкерної вилки.',
  }),
  screw('palletScrew1', 'screw-bridge', 'train', POS.palletScrew1, 5, ['palletBridge']),
  screw('palletScrew2', 'screw-bridge', 'train', POS.palletScrew2, 5, ['palletBridge']),
  part('balance', 'Баланс', 'train', POS.balance, 6.5, ['palletBridge', 'trainBridge'], {
    basic: true,
    hitR: 4,
    desc: 'Серце годинника. Гойдається п’ять разів на секунду й задає точність ходу.',
  }),
  part('hairspring', 'Спіраль', 'train', POS.balance, 7, ['balance'], {
    hitR: 3.5,
    desc: 'Тонка, як волосина, пружинка. Вона повертає баланс назад, і від її довжини залежить точність.',
  }),
  part('cock', 'Місток балансу', 'train', POS.balance, 8.6, ['hairspring'], {
    basic: true,
    hitR: 3,
    desc: 'Тримає верхню цапфу балансу. Часто це найгарніший і найдекоративніший міст механізму.',
  }),
  screw('cockScrew', 'screw-bridge', 'train', POS.cock, 8.6, ['cock']),
  part('regulator', 'Регулятор', 'train', POS.regulator, 8.8, ['cock'], {
    hitR: 2,
    desc: 'Важілець на містку балансу. Рухаючи його, майстер змінює робочу довжину спіралі: годинник іде швидше або повільніше.',
  }),
  part('capJewel', 'Накладний камінь', 'train', POS.balance, 8.9, ['cock'], {
    hitR: 1.6,
    desc: 'Рубін над цапфою балансу. Каміння зменшує тертя й майже не зношується.',
  }),
  screw('capScrew', 'screw-small', 'train', [POS.balance[0] + 0.9, POS.balance[1] + 1.1], 8.9, ['capJewel']),

  // Keyless works, dial side
  part('windingPinion', 'Заводний триб', 'dial', POS.windingPinion, -3, ['mainplate'], {
    desc: 'Сидить на заводному валу. Передає оберт головки на коронне колесо.',
  }),
  part('clutch', 'Кулачкова муфта', 'dial', POS.clutch, -3, ['windingPinion'], {
    desc: 'Перемикає вал між двома режимами: завід і переведення стрілок.',
  }),
  part('stem', 'Заводний вал', 'dial', [0, 15], -3, ['clutch', 'mainplate'], {
    basic: true,
    hitR: 4,
    desc: 'Довгий стрижень від заводної головки всередину механізму.',
  }),
  part('lever', 'Важіль переведення', 'dial', POS.lever, -3.2, ['stem'], {
    desc: 'Коли ви витягаєте головку, цей важіль пересуває муфту.',
  }),
  part('yoke', 'Коромисло', 'dial', POS.yoke, -3.2, ['lever'], {
    desc: 'Передає рух важеля на кулачкову муфту.',
  }),
  part('keylessPlate', 'Накладка заводу', 'dial', POS.keylessPlate, -4, ['yoke'], {
    hitR: 4,
    desc: 'Плоска пластина, що накриває важіль і коромисло.',
  }),
  screw('keylessScrew1', 'screw-small', 'dial', POS.keylessScrew1, -4, ['keylessPlate']),
  screw('keylessScrew2', 'screw-small', 'dial', POS.keylessScrew2, -4, ['keylessPlate']),

  // Motion works
  part('cannon', 'Хвилинний триб', 'dial', O, -4.5, ['centre', 'mainplate'], {
    basic: true,
    hitR: 2.5,
    desc: 'Трубка на осі центрального колеса. Несе хвилинну стрілку й тримається на тертя, тому стрілки можна переводити.',
  }),
  part('minute', 'Вексельне колесо', 'dial', POS.minute, -2.6, ['cannon'], {
    basic: true,
    hitR: 3.5,
    desc: 'Сповільнює обертання від хвилинної стрілки до годинної в поєднанні з часовим колесом.',
  }),
  part('minuteBridge', 'Накладка вексельного колеса', 'dial', POS.minuteBridge, -4, ['minute'], {
    hitR: 3,
    desc: 'Утримує вексельне колесо на місці.',
  }),
  screw('minuteScrew', 'screw-small', 'dial', POS.minuteScrew, -4, ['minuteBridge']),
  part('hour', 'Часове колесо', 'dial', O, -3.3, ['minute'], {
    basic: true,
    hitR: 3.5,
    desc: 'Робить один оберт за 12 годин і несе годинну стрілку.',
  }),
  part('setting', 'Перевідне колесо', 'dial', POS.setting, -2.6, ['minute'], {
    hitR: 2.5,
    desc: 'Коли головку витягнуто, це колесо передає її рух на стрілки.',
  }),

  // Dial and hands
  part('dial', 'Циферблат', 'dial', O, -5.3, ['hour', 'stem'], {
    basic: true,
    hitR: 18,
    tight: 'dial',
    desc: 'Емальований диск із римськими цифрами. Він закриває весь механізм із цього боку, тож гвинти під ним мають бути затягнуті.',
  }),
  screw('dialScrew1', 'screw-dial', 'train', POS.dialScrew1, 0, ['dial']),
  screw('dialScrew2', 'screw-dial', 'train', POS.dialScrew2, 0, ['dial']),
  part('hourHand', 'Годинна стрілка', 'dial', O, -6, ['dial'], {
    basic: true,
    hitR: 4,
    desc: 'Коротка стрілка. Насаджується на трубку часового колеса.',
  }),
  part('minuteHand', 'Хвилинна стрілка', 'dial', O, -6.4, ['hourHand'], {
    basic: true,
    hitR: 4,
    desc: 'Довга стрілка. Насаджується на хвилинний триб.',
  }),
  part('secondsHand', 'Секундна стрілка', 'dial', POS.fourth, -5.8, ['dial', 'fourth'], {
    basic: true,
    hitR: 2.5,
    desc: 'Крихітна стрілка на малому циферблаті, на осі секундного колеса.',
  }),

  // The case
  part('case', 'Корпус', 'any', O, 0, ['minuteHand', 'secondsHand', 'cock', 'ratchet', 'crownWheel'], {
    basic: true,
    hitR: 19,
    tight: 'all',
    desc: 'Золотий корпус із дужкою. Механізм ляже в нього лише повністю зібраним і з затягнутими гвинтами.',
  }),
  part('crown', 'Заводна головка', 'any', POS.crown, 0, ['case', 'stem'], {
    basic: true,
    hitR: 5,
    desc: 'Накручується на заводний вал ззовні корпусу. Нею ви заведете годинник.',
  }),
  part('caseBack', 'Задня кришка', 'train', O, 10, ['crown', 'case'], {
    basic: true,
    hitR: 18,
    desc: 'Закриває механізм від пилу. Останній крок перед заводом.',
  }),
];

export const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p]));

export const LEVELS = {
  apprentice: { id: 'apprentice', name: 'Учень', note: 'Лише ключові деталі, дрібниці стають на місце самі' },
  master: { id: 'master', name: 'Майстер', note: 'Усі деталі, зокрема кожен гвинт' },
};
