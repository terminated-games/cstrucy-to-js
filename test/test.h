#include "ITEM" @application/item-type

struct test {
  int test;
};

struct inventory_item {
  int id;
  int x;
  int y;

  #define data.type = await ITEM.getItemType(data.id)

  switch (data.type) {
    case ITEM.PET:
    int growth;
    break;

    default:
    short enchant;
    short combine;
    break;

  };

  int test;

  // struct test razdwatrzy[2][12];
  // int hello[40];
};


struct character {
  // struct inventory inventory[64];

  text name[4][13][13];
  struct inventory_item inventory[64];
};