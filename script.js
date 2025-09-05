// ** Reemplaza con tus credenciales de Firebase **
const firebaseConfig = {
    apiKey: "AIzaSyC0A23gHmBAibEXCDtm4W4LAGIbvzdZ7YU",
    authDomain: "solouno-a3ed4.firebaseapp.com",
    projectId: "solouno-a3ed4",
    storageBucket: "solouno-a3ed4.firebasestorage.app",
    messagingSenderId: "908693555850",
    appId: "1:908693555850:web:8220babea307ddb97c3b73",
    measurementId: "G-NND0GMGDS9"
};



// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Referencias a elementos del DOM
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const userDisplayName = document.getElementById('user-display-name');
const createPollForm = document.getElementById('create-poll-form');
const pollsList = document.getElementById('polls-list');

// Escucha los cambios de estado de autenticación
auth.onAuthStateChanged(user => {
    if (user) {
        authContainer.style.display = 'none';
        appContainer.style.display = 'block';
        userDisplayName.textContent = user.email;
        loadPolls(user.uid);
    } else {
        authContainer.style.display = 'block';
        appContainer.style.display = 'none';
        pollsList.innerHTML = '<p>Inicia sesión para ver y crear encuestas.</p>';
    }
});

// Lógica de registro e inicio de sesión
registerBtn.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await auth.createUserWithEmailAndPassword(email, password);
        alert("¡Registro exitoso! Ya puedes iniciar sesión.");
    } catch (error) {
        alert("Error al registrar: " + error.message);
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        alert("Error al iniciar sesión: " + error.message);
    }
});

logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

// Función para crear una nueva encuesta
createPollForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) {
        alert("Debes iniciar sesión para crear una encuesta.");
        return;
    }

    const question = document.getElementById('question').value;
    const option1 = document.getElementById('option1').value;
    const option2 = document.getElementById('option2').value;

    const newPoll = {
        question,
        options: [
            { text: option1, votes: 0 },
            { text: option2, votes: 0 }
        ],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        closedAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdBy: user.uid,
        creatorEmail: user.email // Agregamos el email del creador
    };

    try {
        await db.collection('polls').add(newPoll);
        createPollForm.reset();
    } catch (error) {
        console.error("Error al crear la encuesta: ", error);
        alert("Hubo un error al crear la encuesta. Inténtalo de nuevo.");
    }
});

// Función para votar
async function vote(pollId, optionIndex) {
    const user = auth.currentUser;
    if (!user) {
        alert("Debes iniciar sesión para votar.");
        return;
    }

    const voteRef = db.collection('votes').doc(`${user.uid}-${pollId}`);
    try {
        const doc = await voteRef.get();
        if (doc.exists) {
            alert("Ya has votado en esta encuesta.");
            return;
        }

        await db.runTransaction(async (transaction) => {
            const pollRef = db.collection('polls').doc(pollId);
            const pollDoc = await transaction.get(pollRef);
            if (!pollDoc.exists) {
                throw "La encuesta no existe!";
            }
            
            const closedAt = pollDoc.data().closedAt.toDate();
            if (new Date() >= closedAt) {
                throw "La encuesta ya ha cerrado.";
            }

            const currentVotes = pollDoc.data().options[optionIndex].votes;
            const updatedOptions = [...pollDoc.data().options];
            updatedOptions[optionIndex].votes = currentVotes + 1;
            transaction.update(pollRef, { options: updatedOptions });

            transaction.set(voteRef, {
                userId: user.uid,
                pollId: pollId,
                votedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
    } catch (e) {
        console.error("Error en la transacción de voto: ", e);
        if (e.message && e.message.includes("ha cerrado")) {
            alert("La encuesta ya ha cerrado.");
        } else {
            alert("Hubo un error al registrar tu voto.");
        }
    }
}

// Función para cargar las encuestas y renderizarlas
function loadPolls(currentUserId) {
    db.collection('polls').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        const polls = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderPolls(polls, currentUserId);
    });
}

// Función para renderizar las encuestas (corregida)
async function renderPolls(polls, currentUserId) {
    pollsList.innerHTML = ''; // Limpiamos la lista para reconstruirla

    const votedPolls = await getVotedPolls(currentUserId);

    polls.forEach(poll => {
        // Creamos el contenedor principal de la encuesta
        const pollItem = document.createElement('div');
        pollItem.className = 'card poll-item';
        
        // Agregamos el autor y el título
        const creatorInfo = document.createElement('p');
        creatorInfo.innerHTML = `Creado por: <strong>${poll.creatorEmail}</strong>`;
        pollItem.appendChild(creatorInfo);

        const questionHeader = document.createElement('h3');
        questionHeader.textContent = poll.question;
        pollItem.appendChild(questionHeader);

        const closedAt = poll.closedAt.toDate();
        const now = new Date();
        const isClosed = now >= closedAt;
        const hasVoted = votedPolls.includes(poll.id);

        if (isClosed) {
            // Caso 1: Encuesta cerrada
            const totalVotes = poll.options[0].votes + poll.options[1].votes;
            
            const resultsDiv = document.createElement('div');
            resultsDiv.className = 'results';
            
            resultsDiv.innerHTML = `
                <h4>Resultados (Total: ${totalVotes} votos)</h4>
                <p>${poll.options[0].text}: ${poll.options[0].votes} votos</p>
                <div class="result-bar">
                    <div class="option1-bar" style="width: ${totalVotes > 0 ? (poll.options[0].votes / totalVotes) * 100 : 0}%;">
                        ${totalVotes > 0 ? (poll.options[0].votes / totalVotes * 100).toFixed(1) : 0}%
                    </div>
                </div>
                <p>${poll.options[1].text}: ${poll.options[1].votes} votos</p>
                <div class="result-bar">
                    <div class="option2-bar" style="width: ${totalVotes > 0 ? (poll.options[1].votes / totalVotes) * 100 : 0}%;">
                        ${totalVotes > 0 ? (poll.options[1].votes / totalVotes * 100).toFixed(1) : 0}%
                    </div>
                </div>
            `;
            pollItem.appendChild(resultsDiv);

        } else if (hasVoted) {
            // Caso 2: El usuario ya ha votado
            const votedMessage = document.createElement('p');
            votedMessage.className = 'voted-message';
            votedMessage.textContent = '¡Ya has votado en esta encuesta!';
            pollItem.appendChild(votedMessage);

        } else {
            // Caso 3: Encuesta activa y el usuario no ha votado
            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'options-container';

            const button1 = document.createElement('button');
            button1.className = 'option-button';
            button1.textContent = poll.options[0].text;
            button1.addEventListener('click', () => vote(poll.id, 0));
            optionsContainer.appendChild(button1);

            const button2 = document.createElement('button');
            button2.className = 'option-button';
            button2.textContent = poll.options[1].text;
            button2.addEventListener('click', () => vote(poll.id, 1));
            optionsContainer.appendChild(button2);
            
            pollItem.appendChild(optionsContainer);
            
            const countdownDiv = document.createElement('p');
            countdownDiv.className = 'countdown';
            countdownDiv.id = `countdown-${poll.id}`;
            pollItem.appendChild(countdownDiv);
            
            updateCountdown(poll.id, closedAt);
            setInterval(() => updateCountdown(poll.id, closedAt), 1000);
        }

        // Agregamos el contenedor principal a la lista de encuestas
        pollsList.appendChild(pollItem);
        
        // Finalmente, agregamos la línea divisoria
        const divider = document.createElement('hr');
        divider.className = 'divider';
        pollsList.appendChild(divider);
    });
}

// Función auxiliar para obtener las encuestas en las que el usuario ya ha votado
async function getVotedPolls(userId) {
    if (!userId) return [];
    const snapshot = await db.collection('votes').where('userId', '==', userId).get();
    return snapshot.docs.map(doc => doc.data().pollId);
}

// Función para el contador
function updateCountdown(pollId, closedAt) {
    const now = new Date();
    const timeLeft = closedAt.getTime() - now.getTime();
    const countdownElement = document.getElementById(`countdown-${pollId}`);

    if (!countdownElement) return;

    if (timeLeft <= 0) {
        countdownElement.textContent = "¡Encuesta cerrada!";
        return;
    }

    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    countdownElement.textContent = `Tiempo restante: ${hours}h ${minutes}m ${seconds}s`;
}