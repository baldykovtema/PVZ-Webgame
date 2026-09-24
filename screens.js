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

    alert(

        "🎯 Мини-игры\n\n" +

        "🌻 1. Собери солнце\n" +

        "🥔 2. Поймай картофель\n" +

        "🧟 3. Уничтожь зомби\n" +

        "🌱 4. Посади растения\n" +

        "☀️ 5. Солнечный марафон\n" +

        "🧠 6. Память растений\n\n" +

        "Сами мини-игры добавим следующим этапом."

    );

}
