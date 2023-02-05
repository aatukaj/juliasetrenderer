/* exported start, end, returnSharedBufferjs */
//Abhi Allu

const canvas = document.getElementById("canvas");
canvas.style.visibility = "visible";
const ctx = canvas.getContext("2d");

canvas.width = document.body.clientWidth;
canvas.height = document.body.clientHeight;

const ar = canvas.width / canvas.height;

const shadercanvas = document.getElementById("shadercanvas");
shadercanvas.style.visibility = "hidden";

shadercanvas.width = document.body.clientWidth;
shadercanvas.height = document.body.clientHeight;

let mode = "ctx2d"

let zoom = 5
let targetX = 0;
let targetY = 0;
let c;

const set = document.getElementById("set")
const params = document.getElementById("params");
const a_input = document.getElementById("a_input");
const b_input = document.getElementById("b_input");
const time_text = document.getElementById("time");
const render_text = document.getElementById("rendermode");
const canvas_container = document.getElementById("canvascontainer");

canvas_container.width = document.body.clientWidth;
canvas_container.height = document.body.clientHeight;
let lastReq;
async function changeMode() {
    if (mode == "threejs") {
        cancelAnimationFrame(lastReq);
    }
    mode = (mode == "ctx2d") ? "threejs" : "ctx2d";
    await render();
    shadercanvas.style.visibility = (shadercanvas.style.visibility == "visible") ? "hidden" : "visible";
    canvas.style.visibility = (canvas.style.visibility == "visible") ? "hidden" : "visible";
    render_text.innerHTML = `render mode: ${mode}`;



}
function reset() {
    zoom = 5;
    targetX = 0;
    targetY = 0;
    if (mode == "ctx2d") {
        render();
    }

}

set.onclick = () => {
    c = [Number(a_input.value), Number(b_input.value)];
    params.value = "custom";
    reset();
};

console.log(params);
params.onchange = () => {
    if (params.value == "custom") {
        return;
    }
    let val = params.value.split(" ");
    const a = Number(val[0])
    const b = Number(val[1])
    c = [a, b];
    a_input.value = a;
    b_input.value = b;
    reset();

};

keys = {}

window.onload = (e) => {
    params.onchange();
};
document.onkeydown = (e) => {
    if (e.key == " ") {
        changeMode();
    }
    keys[e.key] = true;
}
document.onkeyup = (e) => {
    keys[e.key] = false;
    console.log(keys);
}
canvas_container.addEventListener("click", (e) => {
    const x = e.offsetX;
    const y = e.offsetY;
    console.log(x, y)
    targetX = targetX + (x / canvas.width - 0.5) * zoom * ar;
    targetY = targetY + (y / canvas.height - 0.5) * zoom;
    if (e.ctrlKey) {
        zoom /= 0.5;

    }
    else if (e.shiftKey) {
        zoom *= 0.5;
    }
    if (mode == "ctx2d") {
        render();
    }
});

let start,
    end = 0;
const N_THREADS = 8;
const workers = new Array(N_THREADS);
for (let i = 0; i < N_THREADS; i++) {
    workers[i] = new Worker('sharedworker.js');
}

async function returnSharedBufferjs(
    TARGET_X,
    TARGET_Y,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    WINDOW
) {
    var donecount = 0;

    const START_X_TOTAL = TARGET_X - WINDOW * ar / 2
    const START_Y_TOTAL = TARGET_Y - WINDOW / 2
    const X_LEN = CANVAS_WIDTH;
    const Y_LEN = CANVAS_HEIGHT;
    const window = WINDOW;
    const STEP_X = window / Y_LEN;
    const STEP_Y = window / Y_LEN;
    const workerCount = 4;
    const sharedBuffer = new SharedArrayBuffer(X_LEN * Y_LEN * 4);
    const sharedArray = new Uint8ClampedArray(sharedBuffer);
    sharedArray.fill(0);
    const C = c;

    const N_ROWS_PER_THREAD = Math.floor(X_LEN / workerCount);
    var START_YC = N_ROWS_PER_THREAD;

    var parameters = {
        START_X_TOTAL,
        START_Y_TOTAL,
        START_YC,
        STEP_X,
        STEP_Y,
        N_ROWS_PER_THREAD,
        X_LEN,
        sharedArray,
        C,
    };

    for (let i = 0; i < N_THREADS; i++) {
        parameters.START_YC = N_ROWS_PER_THREAD * i;
        workers[i].postMessage(parameters);
    }

    return new Promise((res) => {
        workers.forEach(
            (worker) =>
            (worker.onmessage = () => {
                donecount++;
                if (donecount == N_THREADS) {
                    const array = new Uint8ClampedArray(sharedArray);
                    res({
                        data: new ImageData(array, CANVAS_WIDTH, CANVAS_HEIGHT),
                    });
                }
            })
        );
    });
}

let camera, scene, renderer;
let uniforms, material, mesh;

const windowHalfX = window.innerWidth / 2;
const windowHalfY = window.innerHeight / 2;

init();


function init() {

    camera = new THREE.Camera();
    camera.position.z = 1;
    scene = new THREE.Scene();

    uniforms = {
        resolution: { type: "v2", value: new THREE.Vector2() },
        target: { type: "v2", value: new THREE.Vector2(targetX, -targetY) },
        zoom: { type: "double", value: zoom },
        c: { type: "v2", value: new THREE.Vector2(0, 0) }
    };

    material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: document.getElementById('vertexShader').textContent,
        fragmentShader: document.getElementById('fragmentShader').textContent
    });

    mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    renderer = new THREE.WebGLRenderer({ canvas: shadercanvas });
    renderer.setPixelRatio(1);
    canvas_container.appendChild(renderer.domElement);

    uniforms.resolution.value.x = window.innerWidth;
    uniforms.resolution.value.y = window.innerHeight;
    renderer.setSize(window.innerWidth, window.innerHeight);
}

setInterval(() => {
    const speed = zoom*0.001;
    console.log(speed)
    if(keys.a) {
        targetX -= speed;
    }
    if(keys.d) {
        targetX += speed;
    }
    if(keys.w) {
        targetY -= speed;
    }
    if(keys.s) {
        targetY += speed;
    }
    
}, 1)
onwheel = (e) => {
    if (e.deltaY > 0) {
        zoom *= 1.5;
    }
    else {
        zoom /= 1.5;
    }
    
}

async function render() {


    if (mode == "ctx2d") {
        start = performance.now();
        const res = await returnSharedBufferjs(
            targetX,
            targetY,
            canvas.width,
            canvas.height,
            zoom
        );
        console.log(res);

        ctx.putImageData(res.data, 0, 0);
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 5, 0, 2 * Math.PI, false);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.stroke();
        end = performance.now();
        time_text.innerHTML = `render time: ${Math.round(end - start)} ms`;
    }
    if (mode == "threejs") {
        uniforms.target.value = new THREE.Vector2(targetX, targetY);
        uniforms.zoom.value = zoom;
        uniforms.c.value = new THREE.Vector2(c[0], c[1]);
        renderer.render(scene, camera);
        lastReq = requestAnimationFrame(render);
    }


}


