uniform sampler2D globeTexture;
uniform sampler2D bumpMap; // Bump map uniform
uniform vec3 lightPosition;
uniform vec3 lightColor;
uniform vec3 viewPosition;

uniform float metalness;
uniform float roughness;
uniform float bumpScale; // Bump scale uniform
uniform float lightIntensity; // New uniform for light intensity

varying vec2 vertexUV;
varying vec3 vertexNormal;
varying vec3 vPosition;

void main() {
    vec3 normal = normalize(vertexNormal);

    // Bump mapping effect
    float bump = texture2D(bumpMap, vertexUV).r; // Grayscale height map
    normal += bumpScale * 5.0 * (bump - 0.5); // Adjust normal based on bump scale

    // Direction from surface point to the light
    vec3 lightDir = normalize(lightPosition - vPosition);

    // Diffuse lighting (Lambertian reflectance) with light intensity
    float diff = max(dot(normal, lightDir), 0.0) * lightIntensity;

    // Ambient and diffuse color
    vec3 diffuse = diff * lightColor * (1.0 - metalness);
    vec3 ambient = vec3(0.2, 0.2, 0.2); // Ambient light

    // Final color computation with texture
    vec3 textureColor = texture2D(globeTexture, vertexUV).rgb;
    vec3 finalColor = (ambient + diffuse) * textureColor;

    gl_FragColor = vec4(finalColor, 1.0);
}
