/* =====================================================
   SUN
===================================================== */

function updateSun() {

    document.getElementById("sunCount")
        .textContent =
        getPlayerSun();


    renderPlayersPanel();

}


function spawnSun() {
    const drop = {id: crypto.randomUUID(), x: 10 + Math.random() * 80, y: 10 + Math.random() * 80, remaining: 10000};
    sunDrops.push(drop);
    renderSun(drop);
}

function spawnPlantSun(plant) {
    const drop = {
        id: crypto.randomUUID(),
        x: Math.min(95, Math.max(5, plant.col * 10 + 5 + Math.random() * 6 - 3)),
        y: Math.min(92, Math.max(8, rowCenter(plant.row) + Math.random() * 8 - 4)),
        remaining: 10000,
        ownerId: plant.ownerId
    };
    sunDrops.push(drop);
    renderSun(drop);
}

function renderSun(drop) {
    const element = document.createElement("div");
    element.className = "sun";
    element.dataset.id = drop.id;
    element.textContent = "☀️";
    element.style.left = `${drop.x}%`;
    element.style.top = `${drop.y}%`;
    element.onclick = event => {
        event.stopPropagation();
        if (gameMode === "online" && !isMatchHost()) sendMatchAction({type: "sun", id: drop.id});
        else collectSun(drop.id, currentUser?.id);
    };
    document.getElementById("lawn").appendChild(element);
}

function collectSun(id, ownerId = currentUser?.id) {
    if (!gameRunning || endingGame) return;
    const index = sunDrops.findIndex(drop => drop.id === id);
    if (index < 0) return;
    if (sunDrops[index].ownerId && sunDrops[index].ownerId !== ownerId) return;
    sunDrops.splice(index, 1);
    document.querySelector(`.sun[data-id="${id}"]`)?.remove();
    addPlayerSun(ownerId, 25);
    updateSun();
}

/* =====================================================
   ZOMBIES
===================================================== */

function spawnZombie() {

    const lawn =
        document.getElementById(
            "lawn"
        );


    if (!lawn) {

        return;

    }


    const maxType =
        Math.min(

            zombieTypes.length,

            1 +
            Math.floor(
                currentWave / 3
            )

        );


    const type =
        zombieTypes[
            Math.floor(
                Math.random() *
                maxType
            )
        ];


    const row =
        Math.floor(
            Math.random() * BOARD_ROWS
        );


    const difficultyFactor = gameMode === "online"
        ? ({easy: 1, medium: 1.25, hard: 1.5, insane: 2, impossible: 3, infinite: 4}[currentLobby?.difficulty] ?? 1)
        : 1;
    const zombie = {

        id:
            crypto.randomUUID(),

        row,

        x:
            105,

        hp:
            type.hp * difficultyFactor *
            (1 + currentWave * .12) *
            (gameMode === "mini" && activeMiniGame === "boss" ? 2.5 : 1),

        speed:
            type.speed *
            (1 + currentWave * .04) *
            (gameMode === "mini" && activeMiniGame === "boss" ? 1.2 : 1),

        emoji:
            type.emoji

    };


    zombies.push(
        zombie
    );


    renderZombie(
        zombie
    );

}


function renderZombie(zombie) {

    const lawn =
        document.getElementById(
            "lawn"
        );


    const element =
        document.createElement(
            "div"
        );


    element.className =
        "zombie";


    element.dataset.id =
        zombie.id;


    element.textContent =
        zombie.emoji;


    element.style.left =
        `${zombie.x}%`;


    element.style.top =
        `${rowCenter(zombie.row)}%`;


    lawn.appendChild(
        element
    );

}

/* =====================================================
   GAME LOOPS
===================================================== */

function startGameLoops() {
    stopGame();
    gameRunning = true;
    gameTimer = setInterval(() => {
        if (!gameRunning || endingGame) return;
        spawnElapsed += 100;
        sunElapsed += 100;
        if (waveSpawned < waveSize() && spawnElapsed >= getSpawnDelay()) {
            spawnElapsed = 0;
            spawnZombie();
            waveSpawned++;
        }
        if (sunElapsed >= getSunDelay()) {
            sunElapsed = 0;
            spawnSun();
        }
        for (const drop of [...sunDrops]) {
            drop.remaining -= 100;
            if (drop.remaining <= 0) {
                sunDrops = sunDrops.filter(item => item.id !== drop.id);
                document.querySelector(`.sun[data-id="${drop.id}"]`)?.remove();
            }
        }
        updatePlants();
        updateZombies();
        if (!gameRunning || endingGame) return;
        if (waveSpawned >= waveSize() && zombies.length === 0) {
            if (!isEndless() && currentWave >= getWaveLimit()) {
                void finishLevel();
                return;
            }
            currentWave++;
            waveSpawned = 0;
            spawnElapsed = -3000;
            if (gameMode === "infinite" && (currentWave - 1) % 10 === 0) {
                void openInfinitePlantSelection();
                return;
            }
            document.getElementById("waveNumber").textContent = currentWave;
        }
    }, 100);
}

async function openInfinitePlantSelection() {
    stopGame();
    const pausedState = captureGame();
    const roster = [...selectedPlants];
    openPlantSelection({
        title: `Бесконечная игра • выбор после ${currentWave - 1} волн`,
        description: `Сейчас начинается волна ${currentWave}. Выбери растения для следующих волн.`,
        pool: getUnlockedPlantIds(profile?.unlocked_level || currentLevel),
        selected: roster,
        limit: 10,
        startText: "▶️ ПРОДОЛЖИТЬ ИГРУ",
        onStart: async () => {
            const nextState = {...pausedState, selectedPlants: [...selectedPlants]};
            if (!await saveInfinite(infiniteSlot, nextState)) {
                selectedPlants = roster;
                startGame({...pausedState, selectedPlants: roster});
                return;
            }
            startGame(nextState);
        }
    });
}

function waveSize() {
    if (gameMode === "mini" && activeMiniGame === "rush") return 7 + currentWave * 3;
    if (gameMode === "mini" && activeMiniGame === "wall") return 3 + currentWave * 2;
    if (gameMode === "mini" && activeMiniGame === "boss") return 12 + currentWave * 5;
    return 4 + currentWave * 2;
}

function getSpawnDelay() {
    const base =
        Math.max(1800, 5000 - currentWave * 250);

    if (gameMode === "mini" && activeMiniGame === "rush") return Math.max(900, base - 1300);
    if (gameMode === "mini" && activeMiniGame === "wall") return base + 700;
    if (gameMode === "mini" && activeMiniGame === "boss") return base + 900;

    return base;
}

function getSunDelay() {
    if (gameMode === "mini" && activeMiniGame === "sunrush") return 1800;
    if (gameMode === "mini" && activeMiniGame === "garden") return 2400;
    if (gameMode === "mini" && activeMiniGame === "night") return 6500;

    return 4000;
}

function updatePlants() {
    for (const plant of [...boardPlants]) {
        plant.age = (plant.age ?? 0) + 100;
        plant.cooldown = Math.max(0, (plant.cooldown ?? 0) - 100);
        if (["sunflower", "twinflower", "sunshroom"].includes(plant.plantId)) {
            const sunInterval = gameMode === "mini" && activeMiniGame === "garden" ? 4000 : 8000;
            if (plant.cooldown === 0 && plant.age >= sunInterval) {
                spawnPlantSun(plant);
                if (plant.plantId === "twinflower") spawnPlantSun(plant);
                plant.cooldown = sunInterval;
            }
            continue;
        }
        if (["wallnut", "tallnut", "primalwallnut"].includes(plant.plantId)) continue;
        const x = plant.col * 10 + 5;
        const targets = zombies.filter(z => z.hp > 0 && z.row === plant.row && z.x >= x - 3).sort((a, b) => a.x - b.x);
        if (plant.plantId === "cherry") {
            if (plant.age < 800) continue;
            zombies.filter(z => Math.abs(z.row - plant.row) <= 1 && Math.abs(z.x - x) <= 20).forEach(z => z.hp -= 1000);
            removePlant(plant.id);
        } else if (plant.plantId === "potatomine") {
            if (plant.age >= 3000 && targets.some(z => Math.abs(z.x - x) < 6)) {
                targets.filter(z => Math.abs(z.x - x) < 12).forEach(z => z.hp -= 1000);
                removePlant(plant.id);
            }
        } else if (targets.length && plant.cooldown === 0) {
            const target = targets[0];
            if (plant.plantId === "bokchoy" && target.x - x > 15) continue;
            const damage = {repeater: 40, firepea: 45, bokchoy: 50, corn: 25, cactus: 30, threepeater: 35, melonpult: 55, wintermelon: 50, electricpea: 45, primalpea: 40};
            target.hp -= damage[plant.plantId] ?? 20;
            queueAttack(plant, target);
            if (["icepea", "snowpea", "wintermelon"].includes(plant.plantId)) target.slow = 3000;
            plant.cooldown = plant.plantId === "bokchoy" ? 700 : 1200;
        }
    }
}

function queueAttack(plant, target) {
    const event = {
        id: crypto.randomUUID(),
        plantId: plant.plantId,
        fromX: plant.col * 10 + 8,
        fromY: rowCenter(plant.row),
        toX: Math.max(plant.col * 10 + 8, target.x),
        toY: rowCenter(target.row)
    };
    attackEvents.push(event);
    if (attackEvents.length > 30) attackEvents = attackEvents.slice(-30);
    renderAttack(event);
}

function renderAttack(event) {
    if (!event?.id || renderedAttackEvents.has(event.id)) return;
    renderedAttackEvents.add(event.id);
    const lawn = document.getElementById("lawn");
    if (!lawn) return;

    const projectile = document.createElement("div");
    projectile.className = `projectile ${event.plantId === "bokchoy" ? "punch" : event.plantId}`;
    projectile.style.left = `${event.fromX}%`;
    projectile.style.top = `${event.fromY}%`;
    lawn.appendChild(projectile);

    const animate =
        typeof requestAnimationFrame === "function"
            ? requestAnimationFrame
            : callback => setTimeout(callback, 0);

    animate(() => {
        projectile.style.left = `${event.toX}%`;
        projectile.style.top = `${event.toY}%`;
    });

    setTimeout(() => projectile.remove(), 1500);
}


function updateZombies() {
    for (const zombie of [...zombies]) {
        if (zombie.hp <= 0) {
            zombies = zombies.filter(z => z.id !== zombie.id);
            document.querySelector(`.zombie[data-id="${zombie.id}"]`)?.remove();
            continue;
        }
        const blocker = boardPlants.find(p => p.row === zombie.row && Math.abs(zombie.x - (p.col * 10 + 5)) < 5);
        if (blocker) {
            blocker.health -= 1.2;
            if (blocker.health <= 0) removePlant(blocker.id);
        } else {
            zombie.x -= zombie.speed * .5 * ((zombie.slow ?? 0) > 0 ? .5 : 1);
        }
        zombie.slow = Math.max(0, (zombie.slow ?? 0) - 100);
        const element = document.querySelector(`.zombie[data-id="${zombie.id}"]`);
        if (element) element.style.left = `${zombie.x}%`;
        if (zombie.x < 0) {
            void loseGame();
            return;
        }
    }
}

async function loseGame() {
    if (endingGame) return;
    endingGame = true;
    stopGame();
    if (gameMode === "online") return endOnlineMatch("🧟 Зомби добрались до дома. Поражение!");
    alert("🧟 Зомби добрались до дома. Попробуй ещё раз!");
    if (gameMode === "mini") {
        activeMiniGame = null;
        showMenu();
    } else if (gameMode === "infinite") await showSaves();
    else showMap();
}


function stopGame() {
    gameRunning = false;

    clearInterval(
        gameTimer
    );

    clearInterval(
        spawnTimer
    );

    clearInterval(
        sunTimer
    );


    gameTimer = null;

    spawnTimer = null;

    sunTimer = null;

}


async function finishLevel() {
    if (endingGame) return;
    document.getElementById("retryProgressButton").hidden = true;
    endingGame = true;
    stopGame();
    if (gameMode === "online") return endOnlineMatch("🎉 Все 10 волн пройдены!");
    if (gameMode === "mini") {
        alert("🎯 Мини-игра пройдена!");
        activeMiniGame = null;
        showMenu();
        return;
    }

    if (gameMode !== "campaign") return;


    if (
        !profile ||
        !currentUser
    ) {

        return;

    }


    if (
        currentLevel >
        (profile.unlocked_level || 0)
    ) {

        const newLevel =
            Math.min(
                50,
                currentLevel
            );


        const {
            data,
            error
        } =
            await supabaseClient
                .from("profiles")
                .update({

                    unlocked_level:
                        newLevel

                })
                .eq(
                    "id",
                    currentUser.id
                )
                .select()
                .single();


        if (error || !data) {
            alert("❌ Не удалось сохранить прохождение. Проверь соединение и нажми «Повторить сохранение».");
            endingGame = false;
            document.getElementById("retryProgressButton").hidden = false;
            return;
        }
        if (data) {

            profile =
                data;


            document.getElementById(
                "progressLabel"
            ).textContent =
                profile.unlocked_level;

        }

    }


    alert(

        `🌱 Уровень ${currentLevel} пройден!\n\n` +

        (currentLevel < 50 ? "Следующий уровень разблокирован." : "Все уровни пройдены!")

    );


    showMap();

}


async function exitGame() {
    if (savingGame) return;
    if (!await confirm(gameMode === "infinite" ? "Сохранить игру и выйти?" : "Выйти из уровня?")) return;
    if (gameMode === "online") {
        if (isMatchHost()) await endOnlineMatch("Ведущий завершил матч.");
        else await leaveLobby();
        return;
    }
    stopGame();
    if (gameMode === "infinite") {
        savingGame = true;
        try {
            if (!await saveInfinite(infiniteSlot, captureGame())) {
                startGameLoops();
                return;
            }
            await showSaves();
        } finally {
            savingGame = false;
        }
    } else showMap();
}

function captureGame() {
    return structuredClone({version: 1, wave: currentWave, sun, playerSuns, plants: boardPlants, zombies,
        sunDrops, attackEvents, selectedPlants, matchPlantSelections, activePlantId, waveSpawned, spawnElapsed, sunElapsed, location: "infinite"});
}
