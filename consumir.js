const common = require('oci-common');
const queue = require('oci-queue');
const nodemailer = require('nodemailer');

const queueEndpoint = "https://cell-1.queue.messaging.sa-saopaulo-1.oci.oraclecloud.com"; 
const queueId = "ocid1.queue.oc1.sa-saopaulo-1.amaaaaaajbuj7aiaqgenejzrtlxr36yxe6gn3movehyh3mpsadi33iwyyq5q";
const ociSmtpHost = "smtp.email.sa-saopaulo-1.oci.oraclecloud.com"; 
const ociSmtpUser = "ocid1.user.oc1..aaaaaaaau7bjv4dkp7wvvpeu37tk7klm7wstgssehy4rljrwnvqrpzz3uxuq@ocid1.tenancy.oc1..aaaaaaaajwrhemuddojfdbeplul6pk4w3kbnetrdlvfhn5lhfqpbtp3va2ra.fo.com";
const ociSmtpPass = "Fh};gDbgX8+qB6LX<zB-";
const remetenteAprovado = "jhenniferlincoln@gmail.com"; 

const provider = new common.ConfigFileAuthenticationDetailsProvider("./.oci/config");
const queueClient = new queue.QueueClient({ authenticationDetailsProvider: provider });
queueClient.endpoint = queueEndpoint;

const transporter = nodemailer.createTransport({
    host: ociSmtpHost,
    port: 587,
    secure: false, 
    auth: {
        user: ociSmtpUser,
        pass: ociSmtpPass
    }
});

async function processarFila() {
    console.log("[OCI Worker] Iniciando escuta ativa na fila de pedidos...");

    while (true) {
        try {
            const response = await queueClient.getMessages({ queueId: queueId, timeoutInSeconds: 10, limit: 1 });
            
            if (response.getMessages.messages && response.getMessages.messages.length > 0) {
                const mensagemFila = response.getMessages.messages[0];
                const dadosPedido = JSON.parse(mensagemFila.content);
                const receiptHandle = mensagemFila.receipt; 

                console.log("[DEBUG] Dados completos que chegaram da fila:", dadosPedido);

                console.log(`[OCI Worker] Nova mensagem detectada. Processando e-mail do pedido #${dadosPedido.numeroPedido}...`);

                let corpoItensHtml = "";
                dadosPedido.itens.forEach(item => {
                    corpoItensHtml += `<li><strong>${item.nome}</strong> - Quantidade: ${item.quantidade}</li>`;
                });

                const mailOptions = {
                    from: remetenteAprovado,
                    to: dadosPedido.emailCliente,
                    subject: `Confirmação de Pedido Realizada - Nº ${dadosPedido.numeroPedido}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
                            <h2 style="color: #0066cc;">Obrigado por comprar connosco!</h2>
                            <p>O seu pedido foi gerado com sucesso na nossa plataforma de e-commerce.</p>
                            <hr>
                            <p><strong>Número identificador do pedido:</strong> # ${dadosPedido.numeroPedido}</p>
                            <h3>Itens inclusos no carrinho:</h3>
                            <ul> ${corpoItensHtml} </ul>
                            <hr>
                            <h3 style="text-align: right; color: #333;">Valor Total Confirmado: R$ ${dadosPedido.valorTotal}</h3>
                            <p style="font-size: 12px; color: #777; margin-top: 30px;">Mensagem automatizada gerada via OCI Queue & Email Delivery Service.</p>
                        </div>
                    `
                };

                await transporter.sendMail(mailOptions);
                console.log(`[OCI Worker] E-mail enviado com sucesso para: \${dadosPedido.emailCliente}`);

                const deleteMessagesDetails = {
                    entries: [{ receipt: receiptHandle }]
                };
                await queueClient.deleteMessages({ queueId: queueId, deleteMessagesDetails: deleteMessagesDetails });
                console.log(`[OCI Worker] Mensagem do pedido #${dadosPedido.numeroPedido} removida da fila com sucesso.`);
            }
        } catch (error) {
            console.error("[OCI Worker] Erro crítico no processamento do loop de eventos:", error);
            // Pausa a execução temporariamente para evitar loops infinitos em caso de queda de rede
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

processarFila();