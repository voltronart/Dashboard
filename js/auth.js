async function fazerLogin(email, senha) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    throw error;
  }
  return data;
}

async function fazerLogout() {
  await supabaseClient.auth.signOut();
}

// Liga o formulário de login (index.html) com fazerLogin()
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-login");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      limparErro("erro-login");

      const email = document.getElementById("email").value;
      const senha = document.getElementById("senha").value;

      try {
        await fazerLogin(email, senha);
        window.location.href = "clientes.html"; // redireciona após login
      } catch (error) {
        mostrarErro("erro-login", "E-mail ou senha inválidos.");
      }
    });
  }
});