use serde::{Deserialize, Serialize};
use candid::{Decode, Encode};
use ic_cdk_macros::{update, query};
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    Cell, DefaultMemoryImpl, StableBTreeMap, Storable,
};
use candid::CandidType;
use std::{borrow::Cow, cell::RefCell};

type Memory = VirtualMemory<DefaultMemoryImpl>;
type IdCell = Cell<u64, Memory>;

#[derive(Clone, Serialize, Deserialize, Debug, CandidType)]
struct Note {
    id: u64,
    title: String,
    content: String,
}

impl Storable for Note {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }
}

use ic_stable_structures::storable::BoundedStorable;
impl BoundedStorable for Note {
    const MAX_SIZE: u32 = 2048;
    const IS_FIXED_SIZE: bool = false;
}

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));
    
    static NOTE_STORAGE: RefCell<StableBTreeMap<u64, Note, Memory>> =
        RefCell::new(StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))));
    
    static NEXT_ID: RefCell<IdCell> =
        RefCell::new(Cell::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1))), 1).unwrap());
}

#[update]
fn create(title: String, content: String) -> Result<String, String> {
    let id = NEXT_ID.with(|next_id| {
        let mut cell = next_id.borrow_mut();
        let &current = cell.get();
        cell.set(current + 1);
        current
    });

    let new_note = Note { id, title, content };

    NOTE_STORAGE.with(|store| {
        store.borrow_mut().insert(id, new_note.clone());
    });
    Ok("Note created successfully".into())
}

#[query]
fn get_notes() -> Vec<Note> {
    NOTE_STORAGE.with(|store| {
        store.borrow()
            .iter()
            .map(|(_, note)| note.clone())
            .collect()
    })
}

#[update]
fn edit(id: u64, title: String, content: String) -> Result<String, String> {
    NOTE_STORAGE.with(|store| {
        let mut store = store.borrow_mut();
        if let Some(mut note) = store.get(&id) {
            note.title = title;
            note.content = content;
            store.insert(id, note);
            Ok("Note updated successfully".into())
        } else {
            Err("Note not found".into())
        }
    })
}

#[update]
fn delete(id: u64) -> Result<String, String> {
    NOTE_STORAGE.with(|store| {
        let mut store = store.borrow_mut();

        // Try to remove the note with the given ID
        if store.remove(&id).is_none() {
            return Err("Note not found".to_string());
        }

        // Collect and sort remaining notes by old ID
        let mut notes: Vec<_> = store.iter().map(|(_, note)| note.clone()).collect();
        notes.sort_by_key(|note| note.id);

        // Manually remove all keys
        let keys_to_remove: Vec<u64> = store.iter().map(|(k, _)| k).collect();
        for key in keys_to_remove {
            store.remove(&key);
        }

        // Reinsert notes with new sequential IDs
        for (i, mut note) in notes.into_iter().enumerate() {
            note.id = i as u64 + 1;
            store.insert(note.id, note);
        }

        // Update NEXT_ID to the next available ID
        NEXT_ID.with(|next_id| {
            let _ = next_id.borrow_mut().set(store.len() as u64 + 1);
        });

        Ok("Note deleted and IDs reassigned".to_string())
    })
}


ic_cdk::export_candid!();
