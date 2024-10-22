// Library standar yang digunakan
use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/primitive/string
use cardano/transaction.{OutputReference, Transaction}

// Mendefinisikan parameter datum berupa VerificationKeyHash dengan nama owner
// Datum menyimpan kunci verifikasi pemilik wallet
pub type Datum {
  owner: VerificationKeyHash,
}

// Mendefinisikan parameter redeemer berupa ByteArray dengan nama msg
// Redeemer menyimpan pesan
pub type Redeemer {
  msg: ByteArray,
}

// Validator hello_world merupakan fungsi utama
validator hello_world {
  // Fungsi spend memvalidasi dua kondisi : 
  // redeemer harus "17925" dan pemilik aset (di datum) harus menyetujui transaksi
  spend(
    datum: Option<Datum>,
    redeemer: Redeemer,
    _own_ref: OutputReference,
    tx: Transaction,
  ) {
    // Menampilkan isi dari redeemer di terminal ketika sesi testing
    trace @"redeemer": string.from_bytearray(redeemer.msg)

    // Konsep destructuring dan pattern matching dibutuhkan untuk memahami syntax ini
    // Pada pattern matching terdapat Some dan None
    // Jika parameter datum kosong maka hasilnya None 
    // Transaksi dibatalkan jika hasilnya None
    expect Some(Datum { owner }) = datum

    // Bernilai true jika pesan atau isi redeemer adalah "17925"
    let reference_number = redeemer.msg == "17925"

    // Bernilai true jika pemilik aset (di datum) menyetujui transaksi
    let must_be_sign = list.has(tx.extra_signatories, owner)

    // Operator ? digunakan untuk menampilkan dan menunjukan suatu parameter yang bernilai false
    reference_number? && must_be_sign?
  }

  // Jika validasi gagal karena kondisi tidak terpenuhi maka transaksi dibatalkan
  else(_) {
    fail
  }
}

// Skenario_1 : Pesan atau isi Redeemer tidak valid dan transaksi tidak disetujui user
test scenario_1() {
  let datum =
    Datum { owner: #"00000000000000000000000000000000000000000000000000000000" }
  let redeemer = Redeemer { msg: "Aiken Rocks!" }
  let placeholder_utxo = OutputReference { transaction_id: "", output_index: 0 }
  hello_world.spend(
    Some(datum),
    redeemer,
    placeholder_utxo,
    transaction.placeholder,
  )
}

// Skenario_2 : Pesan atau isi Redeemer valid dan transaksi tidak disetujui user
test scenario_2() {
  let datum =
    Datum { owner: #"00000000000000000000000000000000000000000000000000000000" }
  let redeemer = Redeemer { msg: "17925" }
  let placeholder_utxo = OutputReference { transaction_id: "", output_index: 0 }
  hello_world.spend(
    Some(datum),
    redeemer,
    placeholder_utxo,
    transaction.placeholder,
  )
}

// Skenario_2 : Pesan atau isi Redeemer valid dan transaksi disetujui user
test scenario_3() {
  let datum =
    Datum { owner: #"00000000000000000000000000000000000000000000000000000000" }
  let redeemer = Redeemer { msg: "17925" }
  let placeholder_utxo = OutputReference { transaction_id: "", output_index: 0 }
  hello_world.spend(
    Some(datum),
    redeemer,
    placeholder_utxo,
    Transaction { ..transaction.placeholder, extra_signatories: [datum.owner] },
  )
}
