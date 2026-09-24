/* =====================================================
   MAP
===================================================== */

function renderMap() {

    const container =
        document.getElementById("locations");


    container.innerHTML = "";


    locations.forEach(location => {

        const box =
            document.createElement("div");


        box.className =
            "location";


        box.innerHTML = `

            <h2>
                ${location.icon}
                ${location.name}
            </h2>

            <div class="levels"></div>

        `;


        const levels =
            box.querySelector(".levels");


        for (
            let level = location.from;
            level <= location.to;
            level++
        ) {

            const button =
                document.createElement("button");


            button.className =
                "level";


            const unlocked =
                level <= Math.max(

                    1,

                    (profile?.unlocked_level || 0)
                    + 1

                );


            button.disabled =
                !unlocked;


            button.textContent =
                unlocked
                    ? level
                    : "🔒";


            if (unlocked) {

                button.onclick =
                    () => chooseLevel(level);

            }


            levels.appendChild(button);

        }


        container.appendChild(box);

    });

}

/* =====================================================
   LEVEL
===================================================== */

function chooseLevel(level) {

    gameMode = "campaign";
    infiniteSlot = null;
    currentLevel =
        level;


    selectedPlants =
        [];


    document.getElementById("selectedLevelTitle")
        .textContent =
        "Уровень " + level;


    document.getElementById("plantDescription")
        .textContent =
        getLocationForLevel(level) +
        ` • ${getWaveLimit()} волн зомби`;


    renderPlants();


    showScreen("plantsScreen");

}


function getLocationForLevel(level) {

    const location =
        locations.find(

            l =>
                level >= l.from &&
                level <= l.to

        );


    return location
        ? location.name
        : "Локация";

}

/* =====================================================
   PLANTS
===================================================== */

function renderPlants() {

    const grid =
        document.getElementById("plantGrid");


    grid.innerHTML = "";


    plants.forEach(plant => {

        const unlocked =
            plant.unlock <= currentLevel;


        const card =
            document.createElement("div");


        card.className =
            "plant" +
            (!unlocked ? " locked" : "");


        if (
            selectedPlants
                .includes(plant.id)
        ) {

            card.classList.add("selected");

        }


        card.innerHTML = `

            <div class="big">
                ${plant.emoji}
            </div>

            <b>
                ${plant.name}
            </b>

            <div>
                ☀️ ${plant.cost}
            </div>

            ${
                unlocked
                    ? "<small>Доступно</small>"
                    : `<small>🔒 Уровень ${plant.unlock}</small>`
            }

        `;


        if (unlocked) {

            card.onclick =
                () => togglePlant(plant.id);

        }


        grid.appendChild(card);

    });


    updateSelectedCount();

}


function togglePlant(id) {

    if (
        selectedPlants
            .includes(id)
    ) {

        selectedPlants =
            selectedPlants.filter(
                x => x !== id
            );

    } else {

        if (
            selectedPlants.length >= 10
        ) {

            alert(
                "Можно выбрать максимум 10 растений."
            );

            return;
        }


        selectedPlants.push(id);

    }


    renderPlants();

}


function updateSelectedCount() {

    document.getElementById("selectedCount")
        .textContent =
        `Выбрано: ${selectedPlants.length} / 10`;

}
