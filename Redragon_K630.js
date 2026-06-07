export function Name() { return "Redragon K630 Custom"; }
export function VendorId() { return 0x320F; }
export function ProductId() { return 0x5000; }
export function Publisher() { return "Mostakim"; }
export function Size() { return [14, 5]; }
export function DeviceType() { return "keyboard"; }
export function Validate(endpoint) { return endpoint.interface === 1 && endpoint.usage === 0x0092; }
export function ImageUrl() { return "https://github.com/Mostakim52/redragon-k630-signalrgb-plugin/raw/main/K630_image.png"; }

/* global
lightingMode:readonly
*/

export function ControllableParameters() {
    return [
        { property: "lightingMode", group: "lighting", label: "Lighting Mode", type: "combobox", values: ["Canvas", "Off"], default: "Canvas" }
    ];
}

const vLedNames = [
    "Esc", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "+", "Backspace",
    "Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\",
    "CapsLock", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "Enter",
    "Left Shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "Right Shift",
    "Left Ctrl", "Left Win", "Left Alt", "Space", "Right Alt", "Fn", "Menu", "Right Ctrl"
];

const vLeds = [
    1, 9, 17, 25, 33, 41, 49, 57, 65, 73, 81, 89, 97, 105,
    2, 10, 18, 26, 34, 42, 50, 58, 66, 74, 82, 90, 98, 106,
    3, 11, 19, 27, 35, 43, 51, 59, 67, 75, 83, 91, 107,
    4, 20, 28, 36, 44, 52, 60, 68, 76, 84, 92, 108,
    5, 13, 21, 45, 77, 85, 93, 101
];

const vLedPositions = [
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0],
    [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [13, 2],
    [0, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3], [13, 3],
    [0, 4], [1, 4], [2, 4], [6, 4], [10, 4], [11, 4], [12, 4], [13, 4]
];

export function Initialize() {
    device.setName(Name());
    device.setSize(Size());
    device.setControllableLeds(vLedNames, vLedPositions);
    setSoftwareMode();
}

export function Render() {
    sendColors(lightingMode === "Off" ? "#000000" : null);
}

export function Shutdown(SystemSuspending) {
    sendColors("#000000"); 
}

function setSoftwareMode() {
    device.write([0x04, 0x8c, 0x00, 0x0b, 0x30, 0x50, 0x01], 64);
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : null;
}

function sendColors(overrideColor) {
    // K630 max LED is 108. 108*3 = 324. We use 336 so it is perfectly divisible by 56 bytes per packet (6 packets).
    const RGBData = new Array(336).fill(0); 

    for (let i = 0; i < vLeds.length; i++) {
        const x = vLedPositions[i][0];
        const y = vLedPositions[i][1];
        let color;

        if (overrideColor) {
            color = hexToRgb(overrideColor);
        } else {
            color = device.color(x, y);
        }

        if(color){
            const ledIndex = vLeds[i] * 3;
            RGBData[ledIndex] = color[0];
            RGBData[ledIndex + 1] = color[1];
            RGBData[ledIndex + 2] = color[2];
        }
    }

    writeRGBPackage(RGBData);
}

function getHighLow(index) {
    const high = (index >>> 8) & 0xFF;
    const low = index & 0xFF;
    return { high, low };
}

function calculateChecksum(packet, index, bytesToSend) {
    let packetSum = 0;
    for (let i = 0; i < packet.length; i++) {
        packetSum += packet[i];
    }

    if (index >= 5) {
        return getHighLow(packetSum + ((index - 5) * bytesToSend) + 99);
    }
    return getHighLow(packetSum + (index * bytesToSend) + 74);
}

function writeRGBPackage(RGBData) {
    const bytesToSend = 56;
    const pauseDuration = 1;
    const totalPackets = RGBData.length / bytesToSend;

    for (let index = 0; index < totalPackets; index++) {
        const data = RGBData.slice(index * bytesToSend, (index + 1) * bytesToSend);
        
        const bytesSent = getHighLow(index * bytesToSend);
        const checksum = calculateChecksum(data, index, bytesToSend);

        let packet = [0x04, checksum.low, checksum.high, 0x12, bytesToSend, bytesSent.low, bytesSent.high, 0x00];
        packet = packet.concat(data);

        while (packet.length < 64) {
            packet.push(0);
        }

        device.write(packet, 64);
        device.pause(pauseDuration);
    }
}