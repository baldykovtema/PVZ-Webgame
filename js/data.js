/* =====================================================
   GAME DATA
===================================================== */

const locations = [

    {
        name: "☀️ Дневной сад",
        icon: "🌻",
        from: 1,
        to: 10
    },

    {
        name: "🌙 Ночной сад",
        icon: "🌙",
        from: 11,
        to: 20
    },

    {
        name: "🏊 Дневной бассейн",
        icon: "🏊",
        from: 21,
        to: 30
    },

    {
        name: "🌙🏊 Ночной бассейн",
        icon: "🌙",
        from: 31,
        to: 40
    },

    {
        name: "🏠 Крыша",
        icon: "🏠",
        from: 41,
        to: 50
    }

];


const plants = [

    {
        id: "peashooter",
        name: "Горохострел",
        emoji: "🌱",
        cost: 100,
        unlock: 0
    },

    {
        id: "sunflower",
        name: "Подсолнух",
        emoji: "🌻",
        cost: 50,
        unlock: 1
    },

    {
        id: "wallnut",
        name: "Орех",
        emoji: "🌰",
        cost: 50,
        unlock: 2
    },

    {
        id: "potatomine",
        name: "Картофельная мина",
        emoji: "🥔",
        cost: 75,
        unlock: 3
    },

    {
        id: "cherry",
        name: "Вишнёвая бомба",
        emoji: "🍒",
        cost: 150,
        unlock: 4
    },

    {
        id: "icepea",
        name: "Ледяной горох",
        emoji: "🧊",
        cost: 175,
        unlock: 5
    },

    {
        id: "repeater",
        name: "Двойной горох",
        emoji: "🫘",
        cost: 200,
        unlock: 6
    },

    {
        id: "cactus",
        name: "Кактус",
        emoji: "🌵",
        cost: 125,
        unlock: 7
    },

    {
        id: "corn",
        name: "Кукурузник",
        emoji: "🌽",
        cost: 100,
        unlock: 8
    },

    {
        id: "firepea",
        name: "Огненный горох",
        emoji: "🔥",
        cost: 225,
        unlock: 9
    },

    {
        id: "mushroom",
        name: "Гриб",
        emoji: "🍄",
        cost: 75,
        unlock: 10
    },

    {
        id: "bokchoy",
        name: "Бок-чой",
        emoji: "🥬",
        cost: 125,
        unlock: 11
    }

];

function getUnlockedLevelCap(level = currentLevel) {
    return Math.max(1, level || 1, profile?.unlocked_level || 0);
}

function getUnlockedPlantIds(level = currentLevel) {
    const cap =
        getUnlockedLevelCap(level);

    return plants
        .filter(plant => plant.unlock <= cap)
        .map(plant => plant.id);
}

function filterUnlockedPlants(ids, level = currentLevel) {
    const unlocked =
        new Set(getUnlockedPlantIds(level));

    return (ids || [])
        .filter(id => unlocked.has(id));
}


const zombieTypes = [

    {
        name: "Обычный",
        emoji: "🧟",
        hp: 100,
        speed: .35
    },

    {
        name: "Быстрый",
        emoji: "🏃🧟",
        hp: 75,
        speed: .65
    },

    {
        name: "Ведёрный",
        emoji: "🪣🧟",
        hp: 250,
        speed: .25
    },

    {
        name: "Сильный",
        emoji: "💪🧟",
        hp: 400,
        speed: .2
    }

];

const difficulties = [

    {
        id: "easy",
        emoji: "🟢",
        name: "Лёгкий"
    },

    {
        id: "medium",
        emoji: "🟡",
        name: "Средний"
    },

    {
        id: "hard",
        emoji: "🟠",
        name: "Сложный"
    },

    {
        id: "insane",
        emoji: "🔴",
        name: "Безумный"
    },

    {
        id: "impossible",
        emoji: "💀",
        name: "Невозможный"
    },

    {
        id: "infinite",
        emoji: "♾️",
        name: "Бесконечный"
    }

];
