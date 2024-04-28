const { spawn } = require('child_process');
const readline = require('readline');
const axios = require('axios');
const fs = require('fs');
const ngrok = require('ngrok');

// Función para obtener el archivo version_manifest.json de Mojang
async function obtenerVersionManifest() {
    try {
        const response = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest.json');
        return response.data;
    } catch (error) {
        console.error('Error al obtener el archivo version_manifest.json:', error);
        throw error;
    }
}

// Función para buscar la URL de descarga de la versión especificada
function buscarVersion(versionManifest, version) {
    const foundVersion = versionManifest.versions.find(v => v.id === version);
    if (!foundVersion) {
        throw new Error(`La versión ${version} no está disponible.`);
    }
    return foundVersion.url;
}

// Función para descargar el servidor de Minecraft
async function descargarMinecraftServer(versionUrl) {
    try {
        console.log(`Obteniendo información de la versión desde: ${versionUrl}`);
        const response = await axios.get(versionUrl);
        const { downloads } = response.data;
        const serverUrl = downloads.server.url;
        console.log(`Descargando Minecraft Server desde: ${serverUrl}`);
        const serverResponse = await axios.get(serverUrl, { responseType: 'stream' });
        const fileStream = fs.createWriteStream('server.jar');
        serverResponse.data.pipe(fileStream);
        return new Promise((resolve, reject) => {
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });
    } catch (error) {
        console.error('Error al descargar el servidor de Minecraft:', error);
        throw error;
    }
}

// Función para crear un túnel con ngrok
async function crearTunelNgrok(token) {
    console.log('Creando túnel con Ngrok...');
    try {
        const url = await ngrok.connect({
            authtoken: token,
            addr: '25565', // Puerto predeterminado del servidor de Minecraft
            region: 'us', // Región predeterminada
            proto: 'tcp' // Configurar el protocolo TCP
        });
        console.log(`Túnel Ngrok creado: ${url}`);
        return url;
    } catch (error) {
        console.error('Error al crear el túnel con Ngrok:', error);
        throw error;
    }
}

// Función para ejecutar el servidor de Minecraft
function ejecutarMinecraftServer(ngrokUrl) {
    console.log('Configurando eula...');
    // Crear el archivo eula.txt con eula=true
    fs.writeFileSync('eula.txt', 'eula=true');

    console.log('Ejecutando Minecraft Server...');

    // Iniciar el servidor de Minecraft como un proceso separado
    const serverProcess = spawn('java', ['-jar', 'server.jar']);

    // Capturar la salida estándar del servidor y mostrarla en la consola
    serverProcess.stdout.on('data', (data) => {
        console.log(`${data}`);
        if (data.includes('Done')) {
            console.log('\x1b[42m%s\x1b[0m', 'Servidor iniciado. La IP de tu servidor es: ' + ngrokUrl);
        }
    });

    // Capturar la salida de error del servidor y mostrarla en la consola
    serverProcess.stderr.on('data', (data) => {
        console.error(`[Error del Servidor]: ${data}`);
    });

    // Capturar eventos de cierre del servidor
    serverProcess.on('close', (code) => {
        console.log(`El servidor de Minecraft se ha cerrado con el código ${code}`);
    });
}

// Función principal
async function main() {
    // Interfaz para leer la entrada del usuario desde la consola
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        // Obtener el archivo version_manifest.json de Mojang
        const versionManifest = await obtenerVersionManifest();

        // Preguntar al usuario qué versión desea descargar
        rl.question('¿Qué versión del servidor de Minecraft deseas descargar? ', async (version) => {
            try {
                // Buscar la URL de descarga de la versión especificada
                const versionUrl = buscarVersion(versionManifest, version);

                // Descargar el servidor de Minecraft
                await descargarMinecraftServer(versionUrl);

                // Preguntar al usuario el token de Ngrok
                rl.question('Por favor, introduce tu token de Ngrok: ', async (token) => {
                    try {
                        // Crear túnel con Ngrok
                        const ngrokUrl = await crearTunelNgrok(token);

                        // Mostrar la IP y acceso a la consola de Minecraft
                        console.log(`Puedes acceder al servidor de Minecraft en: ${ngrokUrl}`);

                        // Ejecutar el servidor de Minecraft
                        ejecutarMinecraftServer(ngrokUrl);
                    } catch (error) {
                        console.error(error.message);
                    } finally {
                        // Cerrar la interfaz de lectura de la consola
                        rl.close();
                    }
                });
            } catch (error) {
                console.error(error.message);
                rl.close();
            }
        });
    } catch (error) {
        console.error('Error en la ejecución del script:', error);
        rl.close();
    }
}

// Ejecutar el programa principal
main();
