import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /**
       * O padrão do Next é 1 MB, e ele corta o corpo ANTES da Server Action rodar — a
       * validação de tamanho dentro da action nunca chega a ser consultada, e o que a
       * pessoa vê é um 500 com "Body exceeded 1 MB limit", não a mensagem sobre a foto.
       * Foi o que aconteceu com o limite de 2 MB do avatar e da logo: os dois eram letra
       * morta acima de 1 MB.
       *
       * Precisa ser MAIOR que o maior arquivo aceito (5 MB, a foto de perfil), porque o
       * limite vale para o corpo HTTP cru — o multipart/form-data ainda soma fronteiras,
       * cabeçalhos de parte e metadados de campo por cima do arquivo.
       */
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
