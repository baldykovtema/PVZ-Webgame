/* =====================================================
   SCREEN FUNCTIONS
===================================================== */

function showScreen(id) {

    document
        .querySelectorAll(".screen")
        .forEach(screen => {

            screen.classList.remove("active");

        });


    const screen =
        document.getElementById(id);


    if (screen) {

        screen.classList.add("active");

    }

}


function showLogin() {

    document.getElementById("loginForm")
        .style.display = "block";

    document.getElementById("registerForm")
        .style.display = "none";

    document.getElementById("authMessage")
        .textContent = "";

}


function showRegister() {

    document.getElementById("loginForm")
        .style.display = "none";

    document.getElementById("registerForm")
        .style.display = "block";

    document.getElementById("authMessage")
        .textContent = "";

}


function showMenu() {

    if (!currentUser) {

        showScreen("authScreen");

        return;
    }

    showScreen("menuScreen");

}


function showMap() {

    renderMap();

    showScreen("mapScreen");

}

/* =====================================================
   MINI GAMES
===================================================== */

function miniGames() {
    const parts =
        getGameModal();

    if (!parts) {
        startMiniGame("sunrush");
        return;
    }

    parts.message.textContent =
        "Выбери мини-игру";

    parts.actions.innerHTML =
        "";

    const games = [
        {
            id: "sunrush",
            name: "Солнечный марафон"
        },
        {
            id: "rush",
            name: "Быстрый натиск"
        },
        {
            id: "wall",
            name: "Оборона орехами"
        }
    ];

    games.forEach(game => {
        const button =
            document.createElement("button");

        button.className =
            "primary";

        button.textContent =
            game.name;

        button.onclick =
            () => {
                parts.modal.hidden = true;
                startMiniGame(game.id);
            };

        parts.actions.appendChild(button);
    });

    parts.modal.hidden =
        false;
}

function startMiniGame(id) {
    activeMiniGame =
        id;

    gameMode =
        "mini";

    infiniteSlot =
        null;

    currentLevel =
        Math.max(1, profile?.unlocked_level || 1);

    selectedPlants =
        getUnlockedPlantIds(currentLevel);

    if (id === "wall") {
        selectedPlants =
            filterUnlockedPlants(["peashooter", "sunflower", "wallnut", "icepea", "bokchoy"], currentLevel);
    }

    if (!selectedPlants.length) {
        selectedPlants =
            ["peashooter"];
    }

    startGame({
        version: 1,
        wave: 1,
        sun: id === "sunrush" ? 300 : 175,
        plants: [],
        zombies: [],
        sunDrops: [],
        selectedPlants,
        location: "mini"
    });
}
