
let cart = [];

function getProducts(){
  for(let i = 0; i < localStorage.length; i++){
    const key = localStorage.key(i);
    try{
      const data = JSON.parse(localStorage.getItem(key));
      if(Array.isArray(data) && data.some(p => p.name || p.nombre)){
        return data;
      }
    }catch(e){}
  }
  return [];
}

function renderProducts(){
  const products = getProducts();
  const grid = document.getElementById("productGrid");

  grid.innerHTML = "";

  products.forEach(product => {
    const name = product.name || product.nombre;
    const price = Number(product.salePrice || product.sale || product.price || product.precioVenta || 0);
    const weighable = product.weighable || product.pesable || false;

    grid.innerHTML += `
      <div class="product" onclick="addProduct('${name}', ${price}, ${weighable})">
        ${name}
        <small>${weighable ? "$" + price + "/kg" : "$" + price}</small>
      </div>
    `;
  });
}

function addProduct(name, price, weighable = false){

  if(weighable){

    let amount = prompt("¿Cuánto vas a cobrar de " + name + "?");

    if(amount === null || amount === ""){
      return;
    }

    amount = Number(amount);

    if(isNaN(amount) || amount <= 0){
      alert("Ingresá un monto válido.");
      return;
    }

    let grams = Math.round((amount * 1000) / price);

    cart.push({
      name: name,
      quantity: grams + " g",
      price: price,
      total: amount,
      weighable: true
    });

  }else{

    let existing = cart.find(item => item.name === name && !item.weighable);

    if(existing){
      existing.quantity += 1;
      existing.total = existing.quantity * existing.price;
    }else{
      cart.push({
        name: name,
        quantity: 1,
        price: price,
        total: price,
        weighable: false
      });
    }
  }

  renderCart();
}

function renderCart(){

  let container = document.getElementById("cartItems");
  container.innerHTML = "";

  let total = 0;

  cart.forEach((product, index) => {
    total += product.total;

    container.innerHTML += `
      <tr>
        <td>${product.name}</td>
        <td>${product.quantity}</td>
        <td>
          <input
            class="price-edit"
            type="number"
            value="${product.total}"
            onchange="changePrice(${index}, this.value)"
          >
        </td>
      </tr>
    `;
  });

  document.getElementById("total").innerText = "Total: $" + total;
}

function changePrice(index, newPrice){
  cart[index].total = Number(newPrice);
  renderCart();
}

renderProducts();
