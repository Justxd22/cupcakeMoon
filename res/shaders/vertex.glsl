uniform float lightIntensity;

varying vec2 vertexUV;
varying vec3 vertexNormal;
varying vec3 vPosition;

void main() {
    vertexUV = uv;
    vertexNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
