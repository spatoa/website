{
  description = "Zola static site";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forEachSystem = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forEachSystem (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.zola
              pkgs.nodejs
              pkgs.playwright-driver.browsers
            ];
            shellHook = ''
              export PLAYWRIGHT_BROWSERS_PATH="${pkgs.playwright-driver.browsers}"
              export PLAYWRIGHT_NODEJS_PATH="${pkgs.nodejs}/bin/node"
              export CHROME_BIN="/run/current-system/sw/bin/chromium"
              export CHROME_PATH="/run/current-system/sw/bin/chromium"
              export BROWSER="/run/current-system/sw/bin/chromium"
            '';
          };
        });

      packages = forEachSystem (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.stdenv.mkDerivation {
            pname = "personal-website";
            version = "0.1.0";
            src = ./.;
            nativeBuildInputs = [ pkgs.zola ];
            doCheck = true;
            checkPhase = ''
              runHook preCheck
              zola check
              runHook postCheck
            '';
            buildPhase = ''
              runHook preBuild
              zola build
              runHook postBuild
            '';
            installPhase = ''
              runHook preInstall
              mkdir -p "$out"
              cp -r public/. "$out/"
              runHook postInstall
            '';
          };
        });
    };
}
