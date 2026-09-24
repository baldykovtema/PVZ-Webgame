/* =====================================================
   GAME
===================================================== */

function startGame(saved = null) {
    if (!selectedPlants.length) {
        alert("Выбери хотя бы одно растение.");
        return;
    }
    stopGame();
    endingGame = false;
    document.getElementById("retryProgressButton").hidden = true;
    document.getElementById("exitGameButton").textContent = gameMode === "infinite" ? "💾 Сохранить и выйти" : "← Выйти";
    sun = saved?.sun ?? 150;
    currentWave = saved?.wave ?? 1;
    boardPlants = structuredClone(saved?.plants ?? []);
    zombies = structuredClone(saved?.zombies ?? []);
    sunDrops = structuredClone(saved?.sunDrops ?? []);
    attackEvents = structuredClone(saved?.attackEvents ?? []);
    renderedAttackEvents = new Set();
    waveSpawned = saved?.waveSpawned ?? zombies.length;
    spawnElapsed = saved?.spawnElapsed ?? -5000;
    sunElapsed = saved?.sunElapsed ?? 0;
    activePlantId = selectedPlants.includes(saved?.activePlantId)
        ? saved.activePlantId : selectedPlants[0];
    shovelMode = false;
    document.getElementById("shovelButton").textContent = "🪣 Лопата";
    document.getElementById("shovelButton").style.background = "";
    document.getElementById("levelGameName").textContent = gameMode === "infinite"
        ? `Бесконечная игра • слот ${infiniteSlot}`
        : gameMode === "online" ? "Совместная игра • личное солнце" : `Уровень ${currentLevel}`;
    document.getElementById("waveLimit").textContent = isEndless() ? " / ∞" : ` / ${getWaveLimit()}`;
    document.getElementById("waveNumber").textContent = currentWave;
    document.getElementById("chatMessages").innerHTML = "";
    document.getElementById("chatBox").classList.remove("open");
    document.getElementById("chatBox").hidden = gameMode !== "online";
    document.getElementById("chatButton").hidden = gameMode !== "online";
    if (gameMode === "online") initializePlayerSuns(saved?.playerSuns);
    renderMyPlants();
    renderPlayersPanel();
    createBoard();
    boardPlants.forEach(renderBoardPlant);
    zombies.forEach(renderZombie);
    sunDrops.forEach(renderSun);
    updateSun();
    showScreen("gameScreen");
    gameRunning = true;
    if (gameMode !== "online" || isMatchHost()) startGameLoops();
}

function isEndless() {
    return gameMode === "infinite" || (gameMode === "online" && currentLobby?.difficulty === "infinite");
}

function getWaveLimit() {
    return gameMode === "campaign" ? 5 : 10;
}

function isMatchHost() {
    return currentLobby?.host_id === currentUser?.id;
}

function initializePlayerSuns(savedPlayerSuns = null) {
    playerSuns = {};
    for (const player of matchPlayers) {
        playerSuns[player.user_id] = savedPlayerSuns?.[player.user_id] ?? 150;
    }
}

function getSunOwnerId(ownerId = currentUser?.id) {
    if (gameMode !== "online") return null;
    return ownerId || currentUser?.id;
}

function getPlayerSun(ownerId = currentUser?.id) {
    const sunOwnerId = getSunOwnerId(ownerId);
    return sunOwnerId ? (playerSuns[sunOwnerId] ?? 150) : sun;
}

function setPlayerSun(ownerId, value) {
    const sunOwnerId = getSunOwnerId(ownerId);
    if (!sunOwnerId) {
        sun = value;
        return;
    }
    playerSuns[sunOwnerId] = value;
}

function addPlayerSun(ownerId, amount) {
    setPlayerSun(ownerId, getPlayerSun(ownerId) + amount);
}

function renderPlayersPanel() {
    const panel = document.querySelector(".players-panel");
    panel.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = gameMode === "online" ? "👥 Команда • личное ☀️" : "☀️ Игрок";
    panel.appendChild(title);
    const roster = gameMode === "online" ? matchPlayers : [{username: profile.username}];
    for (const player of roster) {
        const row = document.createElement("div");
        row.className = "player-row";
        const name = document.createElement("span");
        name.textContent = player.username;
        row.appendChild(name);
        const count = document.createElement("b");
        if (gameMode === "online" && player.user_id === currentUser?.id) count.id = "mySun";
        else if (gameMode !== "online") count.id = "mySun";
        count.textContent = getPlayerSun(player.user_id);
        row.appendChild(count);
        panel.appendChild(row);
    }
}


function createBoard() {

    const lawn =
        document.getElementById("lawn");


    lawn.innerHTML = "";


    for (
        let row = 0;
        row < BOARD_ROWS;
        row++
    ) {

        for (
            let col = 0;
            col < 10;
            col++
        ) {

            const cell =
                document.createElement("div");


            cell.className =
                "grid-cell";


            cell.style.left =
                `${col * 10}%`;


            cell.style.top =
                `${rowTop(row)}%`;


            lawn.appendChild(cell);

        }

    }


    lawn.onclick =
        handleLawnClick;

}


function handleLawnClick(event) {

    if (
        event.target !==
        event.currentTarget
    ) {

        return;

    }


    const rect =
        event.currentTarget
            .getBoundingClientRect();


    const x =
        event.clientX -
        rect.left;


    const y =
        event.clientY -
        rect.top;


    const col =
        Math.floor(
            x /
            (rect.width / 10)
        );


    const row =
        Math.floor(
            y /
            (rect.height / BOARD_ROWS)
        );


    if (
        col < 0 ||
        col > 9 ||
        row < 0 ||
        row >= BOARD_ROWS
    ) {

        return;

    }


    if (shovelMode) {

        return;

    }


    plantAt(row, col);

}


function plantAt(row, col, plantId = activePlantId, owner = profile.username, ownerId = currentUser?.id) {
    if (!gameRunning || endingGame || !Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= BOARD_ROWS || col < 0 || col > 9) return;
    if (gameMode === "online" && !isMatchHost()) {
        sendMatchAction({type: "plant", row, col, plantId});
        return;
    }
    const exists = boardPlants.find(p => p.row === row && p.col === col);
    if (exists) return;
    const plant = plants.find(p => p.id === plantId);
    if (!plant || !selectedPlants.includes(plantId)) return;
    if (getPlayerSun(ownerId) < plant.cost) {
        if (owner === profile.username) alert("☀️ Недостаточно солнца!");
        return;
    }
    setPlayerSun(ownerId, getPlayerSun(ownerId) - plant.cost);
    updateSun();
    const boardPlant = {
        id: crypto.randomUUID(), plantId, row, col, owner, ownerId,
        health: plantId === "wallnut" ? 600 : 100,
        cooldown: 0, age: 0
    };
    boardPlants.push(boardPlant);
    renderBoardPlant(boardPlant);
}


function renderBoardPlant(boardPlant) {

    const lawn =
        document.getElementById("lawn");


    const plant =
        plants.find(
            p =>
                p.id ===
                boardPlant.plantId
        );


    const element =
        document.createElement("div");


    element.className =
        "plant-on-board";


    element.dataset.id =
        boardPlant.id;


    element.textContent =
        plant?.emoji || "🌱";


    element.style.left =
        `${boardPlant.col * 10 + 5}%`;


    element.style.top =
        `${rowCenter(boardPlant.row)}%`;


    element.onpointerenter = event => showPlantOwner(boardPlant, event);
    element.onpointermove = movePlantTooltip;
    element.onpointerleave = hidePlantTooltip;


    element.onclick =
        event => {

            event.stopPropagation();


            if (shovelMode) {

                if (
                    boardPlant.owner !==
                    profile.username
                ) {

                    alert(
                        `❌ Это растение принадлежит ${boardPlant.owner}`
                    );

                    return;

                }


                if (gameMode === "online" && !isMatchHost()) {
                    sendMatchAction({type: "remove", id: boardPlant.id});
                } else if (gameRunning) {
                    removePlant(boardPlant.id);
                }


                return;

            }
        };


    lawn.appendChild(
        element
    );

}


function showPlantOwner(boardPlant, event) {
    if (event.pointerType === "touch") return;

    const plant = plants.find(p => p.id === boardPlant.plantId);
    let tooltip = document.getElementById("plant-tooltip");
    if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.id = "plant-tooltip";
        tooltip.className = "plant-tooltip";
        document.body.appendChild(tooltip);
    }

    tooltip.replaceChildren();
    const heading = document.createElement("strong");
    heading.textContent = `${plant?.emoji || "🌱"} ${plant?.name || "Растение"}`;
    const owner = document.createElement("span");
    owner.textContent = `👤 Поставил: ${boardPlant.owner}`;
    const health = document.createElement("span");
    health.textContent = `❤️ Здоровье: ${boardPlant.health}`;
    tooltip.append(heading, owner, health);
    tooltip.hidden = false;
    movePlantTooltip(event);
}

function movePlantTooltip(event) {
    const tooltip = document.getElementById("plant-tooltip");
    if (!tooltip || tooltip.hidden) return;

    const margin = 8;
    const x = Math.min(event.clientX + 16, window.innerWidth - tooltip.offsetWidth - margin);
    const y = Math.max(margin, event.clientY - tooltip.offsetHeight - 12);
    tooltip.style.left = `${Math.max(margin, x)}px`;
    tooltip.style.top = `${Math.min(y, window.innerHeight - tooltip.offsetHeight - margin)}px`;
}

function hidePlantTooltip() {
    const tooltip = document.getElementById("plant-tooltip");
    if (tooltip) tooltip.hidden = true;
}


function removePlant(id) {

    const index =
        boardPlants.findIndex(
            p => p.id === id
        );


    if (index === -1) {

        return;

    }


    const element =
        document.querySelector(
            `.plant-on-board[data-id="${id}"]`
        );


    if (element) {

        element.remove();

    }


    boardPlants.splice(
        index,
        1
    );

}


function toggleShovel() {

    shovelMode =
        !shovelMode;


    const button =
        document.getElementById(
            "shovelButton"
        );


    button.textContent =
        shovelMode
            ? "❌ Лопата включена"
            : "🪣 Лопата";


    button.style.background =
        shovelMode
            ? "#a94c4c"
            : "";

}


function renderMyPlants() {
    const list = document.getElementById("myPlantList");
    list.innerHTML = "";
    selectedPlants.forEach(id => {
        const plant = plants.find(p => p.id === id);
        if (!plant) return;
        const button = document.createElement("button");
        button.className = "my-plant";
        button.textContent = `${plant.emoji} ${plant.cost}`;
        button.title = plant.name;
        button.setAttribute("aria-pressed", String(activePlantId === id));
        button.style.outline = activePlantId === id ? "3px solid #ffdb60" : "none";
        button.onclick = () => {
            activePlantId = id;
            if (shovelMode) toggleShovel();
            renderMyPlants();
        };
        list.appendChild(button);
    });
}
